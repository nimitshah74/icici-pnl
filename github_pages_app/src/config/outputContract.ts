import type { ResultMetrics, WorkbookDownloadOptions } from "../domain/models";

export const DEFAULT_DOWNLOAD_OPTIONS: WorkbookDownloadOptions = {
  includeExcel: true,
  includeCsv: true,
  includeMeta: true,
  downloadMode: "zip",
};

export const EMPTY_RESULT_METRICS: ResultMetrics = {
  executionRows: 0,
  closedTrades: 0,
  unresolvedPositions: 0,
  grossPnl: 0,
  netPnl: 0,
};

// This order mirrors the retained desktop golden workbook and should remain stable.
export const REQUIRED_WORKBOOK_SHEETS = [
  "Combined",
  "FNO",
  "Commodity",
  "Equity",
  "Monthly PnL",
  "Closed Trades",
  "Open Positions",
  "Parsed Rows",
  "Sources",
] as const;

export const PREPARATION_PROGRESS_STEPS = [
  { percent: 20, text: "Validating upload queue..." },
  { percent: 45, text: "Confirming supported statement types..." },
  { percent: 70, text: "Preparing parser contracts from the frozen output spec..." },
  { percent: 100, text: "Frontend scaffold ready for the next parsing and export slices." },
] as const;
