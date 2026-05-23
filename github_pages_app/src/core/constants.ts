export const STATEMENT_PERIOD_PATTERN =
  /(?:(?:Commodity )?Derivatives|Equity) Transaction Statement from (\d{2}-[A-Za-z]{3}-\d{4}) to (\d{2}-[A-Za-z]{3}-\d{4})/;

export const SECURITY_PATTERN =
  /^(?<symbol>[A-Z0-9]+)-(?<family>OPT[A-Z]+|FUT[A-Z]+)-(?<expiry>\d{2}[A-Z]{3}\d{4})-(?:(?<optionType>CE|PE)-(?<strike>\d+(?:\.\d+)?)|(?<futTag>FUT))$/;

export const DATE_ROW_PATTERN = /^\d{2}-\d{2}-\d{4}$/;
export const DERIVATIVE_ROW_START_PATTERN = /^(?:ISEC|MCO)\/\d+(?:\d+)?\/\d+/;
export const EQUITY_ROW_START_PATTERN = /^ISEC\/\d+(?:\d+)?\/\d+/;
export const FOOTER_LINE_PATTERN =
  /^(?:Page \d+ of \d+|Place\b|Date\b|For ICICI Securities Limited\.|This is a computer generated statement|Please note that this statement does not contain)/i;

// The broker PDFs use stable visual column anchors. These boundaries are intentionally
// conservative so small extraction shifts still land in the correct logical column.
export const DERIVATIVE_COLUMN_STARTS = {
  contractNumber: 0,
  exchangeCode: 118,
  orderNo: 158,
  orderTime: 240,
  tradeNo: 290,
  tradeTime: 330,
  security: 380,
  side: 530,
  quantity: 548,
  grossRate: 590,
  totalValue: 650,
  brokerage: 720,
  gst: 770,
  netAmount: 820,
} as const;

export const EQUITY_COLUMN_STARTS = {
  contractNumber: 0,
  settlementNo: 88,
  exchangeCode: 145,
  orderNo: 176,
  orderTime: 260,
  tradeNo: 300,
  tradeTime: 350,
  settlementDate: 398,
  isin: 448,
  security: 510,
  side: 602,
  quantity: 623,
  grossRate: 667,
  totalValue: 718,
  brokerage: 770,
  gst: 810,
  netAmount: 860,
} as const;

export const ZEROISH_TOLERANCE = "0.03";
export const LINE_Y_TOLERANCE = 2;
export const DEFAULT_SETTLEMENT_CLOSE_TIME = "15:30:00";

export const SUMMARY_SHEET_NAMES = [
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
