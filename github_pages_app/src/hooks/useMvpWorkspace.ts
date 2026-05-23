import { useMemo, useState } from "react";

import {
  DEFAULT_DOWNLOAD_OPTIONS,
  EMPTY_RESULT_METRICS,
  PREPARATION_PROGRESS_STEPS,
} from "../config/outputContract";
import type {
  ResultMetrics,
  UploadedPdf,
  WarningItem,
  WorkbookDownloadOptions,
} from "../domain/models";
import { createStableFileId } from "../utils/formatters";

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
    setStatusText("Preparing browser-side parsing pipeline...");

    // This preview runner is intentionally lightweight until the full parser port lands.
    setWarnings((previous) => [
      createWarning(
        "info",
        "Task 3 foundation is in place",
        "This frontend slice includes real upload intake and statement detection. Full trade parsing, workbook generation, and downloads are the next implementation slices.",
      ),
      ...previous,
    ]);

    for (const step of PREPARATION_PROGRESS_STEPS) {
      await new Promise((resolve) => window.setTimeout(resolve, 280));
      setProgressPercent(step.percent);
      setStatusText(step.text);
    }

    setResults({
      executionRows: supportedFiles.length,
      closedTrades: 0,
      unresolvedPositions: uploadedFiles.filter((file) => file.status === "error").length,
      grossPnl: 0,
      netPnl: 0,
    });
    setIsGenerating(false);
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
    analyzeFiles,
    removeFile,
    updateOption,
    generatePreview,
  };
}
