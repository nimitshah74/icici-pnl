export type StatementKind = "FNO" | "MCX" | "EQUITY" | "UNKNOWN";

export type DisplayStatementKind = "FNO" | "COMMODITY" | "EQUITY" | "UNKNOWN";

export type DetectionConfidence = "high" | "medium" | "low";

export type UploadStatus = "queued" | "analyzing" | "ready" | "error";

export interface WorkbookDownloadOptions {
  includeExcel: boolean;
  includeCsv: boolean;
  includeMeta: boolean;
  downloadMode: "excel" | "zip";
}

export interface DetectionEvidence {
  method: "title" | "header" | "content" | "none";
  matchedText?: string;
  notes: string[];
}

export interface PdfDetectionResult {
  statementKind: StatementKind;
  displayKind: DisplayStatementKind;
  confidence: DetectionConfidence;
  supported: boolean;
  titleText: string;
  statementPeriodText?: string;
  evidence: DetectionEvidence;
}

export interface PdfTextSnapshot {
  pageCount: number;
  firstPageText: string;
  scannedText: string;
  sampledPages: number;
}

export interface UploadedPdf {
  id: string;
  file: File;
  status: UploadStatus;
  detection?: PdfDetectionResult;
  error?: string;
}

export interface WarningItem {
  id: string;
  level: "warning" | "error" | "info";
  title: string;
  message: string;
}

export interface ResultMetrics {
  executionRows: number;
  closedTrades: number;
  unresolvedPositions: number;
  grossPnl: number;
  netPnl: number;
}

export interface WorkspaceProgress {
  statusText: string;
  progressPercent: number;
  isGenerating: boolean;
}
