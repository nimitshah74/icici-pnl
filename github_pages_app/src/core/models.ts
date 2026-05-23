import type { Decimal } from "./decimal";
import type { DisplayStatementKind, StatementKind } from "../domain/models";

export interface ParsedSecurity {
  raw: string;
  symbol: string;
  family: string;
  instrumentKind: "OPTION" | "FUTURE" | "EQUITY";
  marketKind: string;
  expiry: string | null;
  optionType: "CE" | "PE" | null;
  strike: Decimal | null;
  isin?: string | null;
  securityName?: string | null;
  matchKey?: string | null;
}

export interface ExecutionRow {
  sequence: number;
  sourcePdf: string;
  statementKind: StatementKind;
  contractNumber: string;
  exchangeCode: string;
  orderNo: string;
  orderTime: string;
  tradeNo: string;
  tradeTime: string;
  security: ParsedSecurity;
  side: "B" | "S";
  quantity: number;
  grossRate: Decimal;
  totalValue: Decimal;
  brokerage: Decimal;
  gst: Decimal;
  netAmount: Decimal;
  rowStt: Decimal;
}

export interface SummaryTotals {
  totalBuyValue: Decimal;
  totalSellValue: Decimal;
  stt: Decimal;
  transactionCharges: Decimal;
  stampDuty: Decimal;
  sebiFees: Decimal;
}

export interface ParsedStatement {
  sourcePdf: string;
  statementKind: StatementKind;
  displayKind: DisplayStatementKind;
  statementPeriod: {
    start: string;
    end: string;
  };
  rows: ExecutionRow[];
  summary: SummaryTotals;
  executionSignature: string;
}

export interface OpenLot {
  row: ExecutionRow;
  remainingQty: number;
}

export interface ReconstructedTrade {
  matchId: number;
  statementKind: StatementKind;
  security: ParsedSecurity;
  position: "LONG" | "SHORT";
  openSide: "B" | "S";
  closeSide: "B" | "S";
  quantity: number;
  openTime: string;
  closeTime: string | null;
  openTradeNo: string;
  closeTradeNo: string | null;
  openRate: Decimal;
  closeRate: Decimal | null;
  grossPnl: Decimal;
  openTotalValue: Decimal;
  closeTotalValue: Decimal;
  buyTotalValue: Decimal;
  sellTotalValue: Decimal;
  allocatedBrokerage: Decimal;
  allocatedGst: Decimal;
  allocatedStt: Decimal;
  allocatedSummaryOnlyStt: Decimal;
  allocatedTransactionCharges: Decimal;
  allocatedStampDuty: Decimal;
  allocatedSebiFees: Decimal;
  closeReason: "TRADE" | "SETTLEMENT";
  tradeStyle: "INTRADAY" | "POSITIONAL" | "DELIVERY" | "";
}

export interface OpenPosition {
  statementKind: StatementKind;
  security: ParsedSecurity;
  side: "B" | "S";
  quantity: number;
  openTime: string;
  tradeNo: string;
  openRate: Decimal;
  totalValue: Decimal;
  brokerage: Decimal;
  gst: Decimal;
  stt: Decimal;
  positionNote: string;
}

export interface SourceManifestEntry {
  pdf: string;
  statementKind: StatementKind;
  periodStart: string;
  periodEnd: string;
  executionRows: number;
}

export interface DuplicateManifestEntry {
  duplicatePdf: string;
  duplicateOfPdf: string;
  statementKind: StatementKind;
}

export interface SourceManifest {
  inputPdfs: string[];
  uniqueStatements: SourceManifestEntry[];
  duplicatesIgnored: DuplicateManifestEntry[];
}

export interface PdfLayoutItem {
  text: string;
  x: number;
  y: number;
  width: number;
}

export interface PdfLayoutLine {
  y: number;
  text: string;
  items: PdfLayoutItem[];
}

export interface PdfPageLayout {
  pageNumber: number;
  lines: PdfLayoutLine[];
  text: string;
}

export interface PdfDocumentLayout {
  pageCount: number;
  firstPageText: string;
  scannedText: string;
  pages: PdfPageLayout[];
}

export interface ProcessedWorkbookData {
  statements: ParsedStatement[];
  rows: ExecutionRow[];
  trades: ReconstructedTrade[];
  openPositions: OpenPosition[];
  sourceManifest: SourceManifest;
  statementPeriod: {
    start: string;
    end: string;
  };
  summary: SummaryTotals;
}
