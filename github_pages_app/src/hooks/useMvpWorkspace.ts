import { useMemo, useState } from "react";

import {
  DEFAULT_DOWNLOAD_OPTIONS,
  EMPTY_RESULT_METRICS,
} from "../config/outputContract";
import type {
  ResultMetrics,
  UploadedPdf,
  WarningItem,
  WorkbookDownloadOptions,
} from "../domain/models";
import { createStableFileId } from "../utils/formatters";
import type { ProcessedWorkbookData } from "../core/models";
import type { WorkbookDataPayload } from "../core/reporting";

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function createWarning(
  level: WarningItem["level"],
  title: string,
  message: string,
  id = `${level}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
): WarningItem {
  return { id, level, title, message };
}

function dedupeUploads(previous: UploadedPdf[], incoming: UploadedPdf[]): UploadedPdf[] {
  const knownIds = new Set(previous.map((item) => item.id));
  return [...previous, ...incoming.filter((item) => !knownIds.has(item.id))];
}

export function useMvpWorkspace() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedPdf[]>([]);
  const [options, setOptions] = useState<WorkbookDownloadOptions>(DEFAULT_DOWNLOAD_OPTIONS);
  const [statusText, setStatusText] = useState("Ready to scan uploaded PDFs.");
  const [progressPercent, setProgressPercent] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [warnings, setWarnings] = useState<WarningItem[]>([]);
  const [results, setResults] = useState<ResultMetrics | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedWorkbookData | null>(null);
  const [workbookPayload, setWorkbookPayload] = useState<WorkbookDataPayload | null>(null);

  const supportedFiles = useMemo(
    () => uploadedFiles.filter((file) => file.status === "ready" && file.detection?.supported),
    [uploadedFiles],
  );

  const canGenerate = supportedFiles.length > 0 && !isGenerating;

  async function analyzeFiles(files: FileList | File[]) {
    const pdfFiles = Array.from(files).filter(isPdf);

    if (pdfFiles.length === 0) {
      setWarnings((previous) => [
        createWarning(
          "warning",
          "No PDF files found",
          "Only PDF uploads are supported in the browser MVP.",
        ),
        ...previous,
      ]);
      return;
    }

    const nextEntries: UploadedPdf[] = pdfFiles.map((file) => ({
      id: createStableFileId(file),
      file,
      status: "analyzing",
    }));

    setResults(null);
    setProcessedData(null);
    setWorkbookPayload(null);
    setStatusText("Reading PDF titles and classifying statement types...");
    setProgressPercent(5);
    setUploadedFiles((previous) => dedupeUploads(previous, nextEntries));

    const { inspectPdfStatement } = await import("../lib/pdf/pdfStatementInspector");

    for (const entry of nextEntries) {
      try {
        const detection = await inspectPdfStatement(entry.file);

        setUploadedFiles((previous) =>
          previous.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  status: detection.supported ? "ready" : "error",
                  detection,
                  error: detection.supported ? undefined : "Unsupported statement format",
                }
              : item,
          ),
        );

        if (!detection.supported) {
          setWarnings((previous) => [
            createWarning(
              "warning",
              `${entry.file.name} was not recognized`,
              "The extracted PDF text did not match the currently supported ICICIdirect statement signatures.",
              `unsupported-${entry.id}`,
            ),
            ...previous,
          ]);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown PDF parsing error";

        setUploadedFiles((previous) =>
          previous.map((item) =>
            item.id === entry.id
              ? { ...item, status: "error", error: message }
              : item,
          ),
        );

        setWarnings((previous) => [
          createWarning(
            "error",
            `${entry.file.name} could not be analyzed`,
            message,
            `error-${entry.id}`,
          ),
          ...previous,
        ]);
      }
    }

    setProgressPercent(100);
    setStatusText("File intake complete. Supported statements are ready for parsing.");
  }

  function removeFile(id: string) {
    setUploadedFiles((previous) => previous.filter((file) => file.id !== id));
    setWarnings((previous) => previous.filter((warning) => !warning.id.includes(id)));
    setResults(null);
    setProcessedData(null);
    setWorkbookPayload(null);
  }

  function updateOption<K extends keyof WorkbookDownloadOptions>(
    key: K,
    value: WorkbookDownloadOptions[K],
  ) {
    setOptions((previous) => ({ ...previous, [key]: value }));
  }

  async function generatePreview() {
    setIsGenerating(true);
    setProgressPercent(0);
    setResults(null);
    setProcessedData(null);
    setWorkbookPayload(null);

    try {
      setStatusText("Loading full PDF layouts...");
      setProgressPercent(10);
      const [{ processUploadedStatements }, reporting] = await Promise.all([
        import("../core/processStatements"),
        import("../core/reporting"),
      ]);
      const processed = await processUploadedStatements(uploadedFiles);

      setStatusText("Reconstructing trades and allocating statement costs...");
      setProgressPercent(70);
      const payload = reporting.buildWorkbookPayload(
        processed.statements,
        processed.rows,
        processed.trades,
        processed.openPositions,
        processed.sourceManifest,
        processed.summary,
        processed.statementPeriod,
      );

      setProcessedData(processed);
      setWorkbookPayload(payload);
      setResults(reporting.metricsFromWorkbookPayload(payload));
      setProgressPercent(100);
      setStatusText("Report generation complete. Downloads are ready.");

      const nextWarnings: WarningItem[] = [];
      if (processed.openPositions.length > 0) {
        nextWarnings.push(
          createWarning(
            "warning",
            "Unresolved open positions remain",
            `${processed.openPositions.length} positions could not be fully realized from the uploaded statements alone.`,
            "open-positions-warning",
          ),
        );
      }
      if (processed.sourceManifest.duplicatesIgnored.length > 0) {
        nextWarnings.push(
          createWarning(
            "info",
            "Duplicate statements were ignored",
            `${processed.sourceManifest.duplicatesIgnored.length} duplicate statements matched an existing execution signature and were skipped.`,
            "duplicate-statements-info",
          ),
        );
      }
      setWarnings((previous) => [
        ...nextWarnings,
        ...previous.filter(
          (warning) =>
            warning.id !== "open-positions-warning" &&
            warning.id !== "duplicate-statements-info",
        ),
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown processing error";
      setStatusText("Generation failed.");
      setProgressPercent(0);
      setWarnings((previous) => [
        createWarning("error", "Report generation failed", message, "generation-failed"),
        ...previous.filter((warning) => warning.id !== "generation-failed"),
      ]);
    } finally {
      setIsGenerating(false);
    }
  }

  async function downloadExcel() {
    if (!processedData || !workbookPayload) {
      return;
    }

    const [{ buildDownloadBundle }, { triggerBrowserDownload }] = await Promise.all([
      import("../core/export/bundle"),
      import("../core/export/downloads"),
    ]);
    const artifact = await buildDownloadBundle(processedData, workbookPayload, {
      ...options,
      includeExcel: true,
      downloadMode: "excel",
    });
    triggerBrowserDownload(artifact.blob, artifact.filename);
  }

  async function downloadBundle() {
    if (!processedData || !workbookPayload) {
      return;
    }

    const [{ buildDownloadBundle }, { triggerBrowserDownload }] = await Promise.all([
      import("../core/export/bundle"),
      import("../core/export/downloads"),
    ]);
    const artifact = await buildDownloadBundle(processedData, workbookPayload, {
      ...options,
      downloadMode: "zip",
    });
    triggerBrowserDownload(artifact.blob, artifact.filename);
  }

  return {
    uploadedFiles,
    options,
    statusText,
    progressPercent,
    isGenerating,
    warnings,
    results: results ?? EMPTY_RESULT_METRICS,
    supportedFiles,
    canGenerate,
    hasDownloads: processedData !== null && workbookPayload !== null,
    analyzeFiles,
    removeFile,
    updateOption,
    generatePreview,
    downloadExcel,
    downloadBundle,
  };
}
