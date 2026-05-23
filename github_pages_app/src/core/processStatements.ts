import type { UploadedPdf } from "../domain/models";
import { ZERO } from "./decimal";
import type { ProcessedWorkbookData } from "./models";
import { extractPdfDocumentLayout } from "./pdf/layoutExtractor";
import { parseInputLayouts, combineSummaries } from "./parsing/statementParser";
import { allocateSummaryCosts, reconstructTrades } from "./reconstruction";

export async function processUploadedStatements(
  uploadedFiles: UploadedPdf[],
): Promise<ProcessedWorkbookData> {
  const readyFiles = uploadedFiles.filter(
    (file) => file.status === "ready" && file.detection?.supported,
  );

  if (readyFiles.length === 0) {
    throw new Error("No supported statements are ready for processing.");
  }

  const parsedLayouts = [];
  for (const entry of readyFiles) {
    parsedLayouts.push({
      file: entry.file,
      layout: await extractPdfDocumentLayout(entry.file),
    });
  }

  const { statements, sourceManifest } = parseInputLayouts(parsedLayouts);
  const rows = statements.flatMap((statement) => statement.rows);
  const statementPeriod = {
    start: statements.reduce(
      (min, statement) => (statement.statementPeriod.start < min ? statement.statementPeriod.start : min),
      statements[0].statementPeriod.start,
    ),
    end: statements.reduce(
      (max, statement) => (statement.statementPeriod.end > max ? statement.statementPeriod.end : max),
      statements[0].statementPeriod.end,
    ),
  };
  const summary = combineSummaries(statements.map((statement) => statement.summary));
  const { trades, openPositions } = reconstructTrades(rows, {});
  allocateSummaryCosts(trades, summary);

  return {
    statements,
    rows,
    trades,
    openPositions,
    sourceManifest,
    statementPeriod,
    summary,
  };
}

export function emptyProcessedWorkbookData(): ProcessedWorkbookData {
  return {
    statements: [],
    rows: [],
    trades: [],
    openPositions: [],
    sourceManifest: {
      inputPdfs: [],
      uniqueStatements: [],
      duplicatesIgnored: [],
    },
    statementPeriod: {
      start: "",
      end: "",
    },
    summary: {
      totalBuyValue: ZERO,
      totalSellValue: ZERO,
      stt: ZERO,
      transactionCharges: ZERO,
      stampDuty: ZERO,
      sebiFees: ZERO,
    },
  };
}
