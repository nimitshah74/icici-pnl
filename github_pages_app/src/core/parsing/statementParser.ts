import { toDisplayStatementKind } from "../../domain/statementKinds";
import type { StatementKind } from "../../domain/models";
import {
  DATE_ROW_PATTERN,
  DERIVATIVE_DETAIL_ROW_START_PATTERN,
  DEFAULT_SETTLEMENT_CLOSE_TIME,
  DERIVATIVE_COLUMN_STARTS,
  DERIVATIVE_ROW_START_PATTERN,
  EQUITY_COLUMN_STARTS,
  EQUITY_ROW_START_PATTERN,
  FOOTER_LINE_PATTERN,
  SECURITY_PATTERN,
  STATEMENT_PERIOD_PATTERN,
  ZEROISH_TOLERANCE,
} from "../constants";
import { Decimal, ZERO } from "../decimal";
import type {
  ExecutionRow,
  ParsedStatement,
  PdfDocumentLayout,
  PdfLayoutItem,
  PdfLayoutLine,
  SourceManifest,
  SummaryTotals,
} from "../models";
import { parseEquitySecurity, parseSecurity } from "../securities";
import {
  buildExecutionSignature,
  cleanSecurity,
  deriveStableRowIdentity,
  normalizeCell,
  parsePdfDateTime,
  parseStatementDate,
  precise,
  toDecimal,
} from "../utils";

type DerivativeColumnKey = keyof typeof DERIVATIVE_COLUMN_STARTS;
type EquityColumnKey = keyof typeof EQUITY_COLUMN_STARTS;

interface ParsedFileInput {
  file: File;
  layout: PdfDocumentLayout;
}

function emptySummaryTotals(): SummaryTotals {
  return {
    totalBuyValue: ZERO,
    totalSellValue: ZERO,
    stt: ZERO,
    transactionCharges: ZERO,
    stampDuty: ZERO,
    sebiFees: ZERO,
  };
}

function inferStatementKind(firstPageText: string): StatementKind {
  if (/Commodity Derivatives Transaction Statement/i.test(firstPageText)) {
    return "MCX";
  }

  if (/Equity Transaction Statement/i.test(firstPageText)) {
    return "EQUITY";
  }

  if (/Derivatives Transaction Statement/i.test(firstPageText)) {
    return "FNO";
  }

  return "UNKNOWN";
}

function parseStatementPeriod(firstPageText: string): { start: string; end: string } {
  const match = STATEMENT_PERIOD_PATTERN.exec(firstPageText);

  if (!match) {
    throw new Error("Could not find statement period on the first page.");
  }

  return {
    start: parseStatementDate(match[1]),
    end: parseStatementDate(match[2]),
  };
}

function deriveRowStt(
  side: "B" | "S",
  totalValue: Decimal,
  brokerage: Decimal,
  gst: Decimal,
  netAmount: Decimal,
): Decimal {
  const residual =
    side === "B"
      ? netAmount.sub(totalValue.add(brokerage).add(gst))
      : totalValue.sub(brokerage).sub(gst).sub(netAmount);

  return residual.abs().lessThan(toDecimal(ZEROISH_TOLERANCE))
    ? ZERO
    : residual.toDecimalPlaces(2);
}

function isFooterOrNoteLine(lineText: string): boolean {
  return FOOTER_LINE_PATTERN.test(lineText) || /^\* GST includes GST$/i.test(lineText);
}

function collectRowBlocks(
  lines: PdfLayoutLine[],
  rowStartPattern: RegExp,
): PdfLayoutLine[][] {
  const blocks: PdfLayoutLine[][] = [];
  let currentBlock: PdfLayoutLine[] = [];

  for (const line of lines) {
    const text = normalizeCell(line.text);

    if (!text) {
      continue;
    }

    if (/^Summary$/i.test(text) || isFooterOrNoteLine(text)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      break;
    }

    if (rowStartPattern.test(text)) {
      const currentStartText = currentBlock[0]
        ? normalizeCell(currentBlock[0].text)
        : "";
      const continuesLegacyDerivativeBlock =
        currentBlock.length > 0 &&
        DERIVATIVE_DETAIL_ROW_START_PATTERN.test(currentStartText) &&
        DERIVATIVE_ROW_START_PATTERN.test(text);

      if (continuesLegacyDerivativeBlock) {
        currentBlock.push(line);
        continue;
      }

      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = [line];
      continue;
    }

    if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  return blocks;
}

function assignItemsToColumns<TColumnName extends string>(
  block: PdfLayoutLine[],
  columnStarts: Record<TColumnName, number>,
): Record<TColumnName, string> {
  const entries = (Object.keys(columnStarts) as TColumnName[])
    .map((key) => [key, columnStarts[key]] as const)
    .sort((left, right) => left[1] - right[1]);
  const values = {} as Record<TColumnName, string[]>;

  for (const [key] of entries) {
    values[key] = [];
  }

  for (const line of block) {
    const sortedItems = [...line.items].sort((left, right) => left.x - right.x);
    for (const item of sortedItems) {
      const text = normalizeCell(item.text);
      if (!text) {
        continue;
      }

      let targetKey = entries[0][0];
      for (const [key, startX] of entries) {
        if (item.x >= startX) {
          targetKey = key;
          continue;
        }
        break;
      }

      values[targetKey].push(text);
    }
  }

  const output = {} as Record<TColumnName, string>;
  for (const [key, parts] of entries.map(([key]) => [key, values[key]] as const)) {
    output[key] = normalizeCell(parts.join(" "));
  }

  return output;
}

function parseDerivativeBlock(
  block: PdfLayoutLine[],
  sequence: number,
  sourcePdf: string,
  statementKind: StatementKind,
): ExecutionRow | null {
  const fields = assignItemsToColumns(block, DERIVATIVE_COLUMN_STARTS);
  const securityValue = cleanSecurity(fields.security);

  if (
    fields.contractNumber &&
    securityValue &&
    SECURITY_PATTERN.test(securityValue)
  ) {
    const brokerage = toDecimal(fields.brokerage);
    const gst = toDecimal(fields.gst);
    const totalValue = toDecimal(fields.totalValue);
    const netAmount = toDecimal(fields.netAmount);
    const side = fields.side as "B" | "S";

    return {
      sequence,
      sourcePdf,
      statementKind,
      contractNumber: fields.contractNumber,
      exchangeCode: fields.exchangeCode,
      orderNo: fields.orderNo,
      orderTime: parsePdfDateTime(fields.orderTime),
      tradeNo: fields.tradeNo,
      tradeTime: parsePdfDateTime(fields.tradeTime),
      security: parseSecurity(fields.security),
      side,
      quantity: Number.parseInt(fields.quantity, 10),
      grossRate: toDecimal(fields.grossRate),
      totalValue,
      brokerage,
      gst,
      netAmount,
      rowStt: deriveRowStt(side, totalValue, brokerage, gst, netAmount),
    };
  }

  return parseDerivativeBlockByAnchors(block, sequence, sourcePdf, statementKind);
}

function parseDerivativeBlockByAnchors(
  block: PdfLayoutLine[],
  sequence: number,
  sourcePdf: string,
  statementKind: StatementKind,
): ExecutionRow | null {
  const items = [...block]
    .sort((left, right) => right.y - left.y)
    .flatMap((line) =>
      [...line.items].sort((left, right) => left.x - right.x).map((item) => ({
        ...item,
        text: normalizeCell(item.text),
      })),
    )
    .filter((item) => item.text);

  const pick = (predicate: (item: PdfLayoutItem) => boolean) => items.find(predicate)?.text ?? "";
  const pickRange = (minX: number, maxX: number, predicate?: (item: PdfLayoutItem) => boolean) =>
    items.find((item) => item.x >= minX && item.x < maxX && (predicate ? predicate(item) : true))?.text ?? "";
  const pickAllRange = (minX: number, maxX: number, predicate?: (item: PdfLayoutItem) => boolean) =>
    items
      .filter((item) => item.x >= minX && item.x < maxX && (predicate ? predicate(item) : true))
      .sort((left, right) => right.y - left.y || left.x - right.x)
      .map((item) => item.text);

  const contractNumber = pick((item) => DERIVATIVE_ROW_START_PATTERN.test(item.text));
  const exchangeCode = pickRange(90, 150, (item) => /^[A-Z]{3}$/.test(item.text));
  const orderNo = pickRange(135, 235, (item) => /^\d{8,}$/.test(item.text));
  const tradeNo = pickRange(255, 330, (item) => /^\d{5,}$/.test(item.text));
  const dateTokens = items
    .filter((item) => DATE_ROW_PATTERN.test(item.text) && item.x < 370)
    .sort((left, right) => left.x - right.x || right.y - left.y)
    .map((item) => item.text);
  const timeTokens = items
    .filter((item) => /^\d{2}:\d{2}:\d{2}$/.test(item.text) && item.x < 380)
    .sort((left, right) => left.x - right.x || right.y - left.y)
    .map((item) => item.text);
  const securityParts = [
    ...pickAllRange(360, 500, (item) => /[A-Z@-]/.test(item.text)),
    ...pickAllRange(410, 470, (item) => /^\d+(?:\.\d+)?$/.test(item.text)),
  ];
  const security = cleanSecurity(securityParts.join(" "));
  const side = pickRange(500, 530, (item) => /^(B|S)$/.test(item.text)) as "B" | "S";
  const quantity = pickRange(530, 565, (item) => /^\d+$/.test(item.text));
  const grossRate = pickRange(585, 635, (item) => /^\d+(?:\.\d+)?$/.test(item.text));
  const totalValueText = pickRange(640, 690, (item) => /^\d+(?:\.\d+)?$/.test(item.text));
  const brokerageText = pickRange(700, 740, (item) => /^\d+(?:\.\d+)?$/.test(item.text));
  const gstText = pickRange(750, 790, (item) => /^\d+(?:\.\d+)?$/.test(item.text));
  const netAmountText = pickRange(800, 860, (item) => /^\d+(?:\.\d+)?$/.test(item.text));

  if (
    !contractNumber ||
    !exchangeCode ||
    !orderNo ||
    !tradeNo ||
    dateTokens.length < 2 ||
    timeTokens.length < 2 ||
    !security ||
    !SECURITY_PATTERN.test(security) ||
    !side ||
    !quantity ||
    !grossRate ||
    !totalValueText ||
    !brokerageText ||
    !gstText ||
    !netAmountText
  ) {
    return null;
  }

  const totalValue = toDecimal(totalValueText);
  const brokerage = toDecimal(brokerageText);
  const gst = toDecimal(gstText);
  const netAmount = toDecimal(netAmountText);

  return {
    sequence,
    sourcePdf,
    statementKind,
    contractNumber,
    exchangeCode,
    orderNo,
    orderTime: parsePdfDateTime(`${dateTokens[0]} ${timeTokens[0]}`),
    tradeNo,
    tradeTime: parsePdfDateTime(`${dateTokens[1]} ${timeTokens[1]}`),
    security: parseSecurity(security),
    side,
    quantity: Number.parseInt(quantity, 10),
    grossRate: toDecimal(grossRate),
    totalValue,
    brokerage,
    gst,
    netAmount,
    rowStt: deriveRowStt(side, totalValue, brokerage, gst, netAmount),
  };
}

function parseEquityBlock(
  block: PdfLayoutLine[],
  sequence: number,
  sourcePdf: string,
): ExecutionRow | null {
  const fields = assignItemsToColumns(block, EQUITY_COLUMN_STARTS);

  if (!fields.contractNumber || !fields.isin || !fields.security) {
    return null;
  }

  const brokerage = toDecimal(fields.brokerage);
  const gst = toDecimal(fields.gst);
  const totalValue = toDecimal(fields.totalValue);
  const netAmount = toDecimal(fields.netAmount);
  const side = fields.side as "B" | "S";

  return {
    sequence,
    sourcePdf,
    statementKind: "EQUITY",
    contractNumber: fields.contractNumber,
    exchangeCode: fields.exchangeCode,
    orderNo: fields.orderNo,
    orderTime: parsePdfDateTime(fields.orderTime),
    tradeNo: fields.tradeNo,
    tradeTime: parsePdfDateTime(fields.tradeTime),
    security: parseEquitySecurity(fields.isin, fields.security),
    side,
    quantity: Number.parseInt(fields.quantity, 10),
    grossRate: toDecimal(fields.grossRate),
    totalValue,
    brokerage,
    gst,
    netAmount,
    rowStt: deriveRowStt(side, totalValue, brokerage, gst, netAmount),
  };
}

function parseDerivativeSummary(layout: PdfDocumentLayout): SummaryTotals {
  let totalRow: RegExpExecArray | null = null;

  for (const page of layout.pages) {
    for (const line of page.lines) {
      const text = normalizeCell(line.text);
      const match = /^Total\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)$/.exec(text);
      if (match) {
        totalRow = match;
      }
    }
  }

  if (!totalRow) {
    throw new Error("Could not find the summary total row.");
  }

  return {
    totalBuyValue: toDecimal(totalRow[1]),
    totalSellValue: toDecimal(totalRow[2]),
    stt: toDecimal(totalRow[3]),
    transactionCharges: toDecimal(totalRow[4]),
    stampDuty: toDecimal(totalRow[5]),
    sebiFees: toDecimal(totalRow[6]),
  };
}

function parseEquitySummary(layout: PdfDocumentLayout, rows: ExecutionRow[]): SummaryTotals {
  const summary = emptySummaryTotals();

  for (const page of layout.pages) {
    for (const line of page.lines) {
      const text = normalizeCell(line.text);
      const match =
        /^(\d{2}-\d{2}-\d{4})\s+\S+\s+\S+\s+(\d{2}-\d{2}-\d{4})\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+Net amount/i.exec(
          text,
        );

      if (!match || !DATE_ROW_PATTERN.test(match[1])) {
        continue;
      }

      summary.stt = summary.stt.add(toDecimal(match[3]));
      summary.transactionCharges = summary.transactionCharges.add(toDecimal(match[4]));
      summary.stampDuty = summary.stampDuty.add(toDecimal(match[5]));
    }
  }

  for (const row of rows) {
    if (row.side === "B") {
      summary.totalBuyValue = summary.totalBuyValue.add(row.totalValue);
    } else {
      summary.totalSellValue = summary.totalSellValue.add(row.totalValue);
    }
  }

  return summary;
}

function executionRowIdentity(row: ExecutionRow): string {
  return deriveStableRowIdentity([
    row.statementKind,
    row.contractNumber,
    row.exchangeCode,
    row.orderNo,
    row.orderTime,
    row.tradeNo,
    row.tradeTime,
    row.security.raw,
    row.side,
    row.quantity,
    row.grossRate,
    row.totalValue,
    row.brokerage,
    row.gst,
    row.netAmount,
  ]);
}

export function combineSummaries(summaries: SummaryTotals[]): SummaryTotals {
  return summaries.reduce(
    (combined, summary) => ({
      totalBuyValue: combined.totalBuyValue.add(summary.totalBuyValue),
      totalSellValue: combined.totalSellValue.add(summary.totalSellValue),
      stt: combined.stt.add(summary.stt),
      transactionCharges: combined.transactionCharges.add(summary.transactionCharges),
      stampDuty: combined.stampDuty.add(summary.stampDuty),
      sebiFees: combined.sebiFees.add(summary.sebiFees),
    }),
    emptySummaryTotals(),
  );
}

export function parseStatementLayout(
  layout: PdfDocumentLayout,
  sourcePdf: string,
): ParsedStatement {
  const statementKind = inferStatementKind(layout.firstPageText);

  if (statementKind === "UNKNOWN") {
    throw new Error("Unsupported statement type.");
  }

  const statementPeriod = parseStatementPeriod(layout.firstPageText);
  const rows: ExecutionRow[] = [];
  let sequence = 1;

  for (const page of layout.pages) {
    const derivativeRowStartPattern = new RegExp(
      `${DERIVATIVE_ROW_START_PATTERN.source}|${DERIVATIVE_DETAIL_ROW_START_PATTERN.source}`,
    );
    const blocks = collectRowBlocks(
      page.lines,
      statementKind === "EQUITY" ? EQUITY_ROW_START_PATTERN : derivativeRowStartPattern,
    );

    for (const block of blocks) {
      const parsedRow =
        statementKind === "EQUITY"
          ? parseEquityBlock(block, sequence, sourcePdf)
          : parseDerivativeBlock(block, sequence, sourcePdf, statementKind);

      if (!parsedRow) {
        continue;
      }

      rows.push(parsedRow);
      sequence += 1;
    }
  }

  if (rows.length === 0) {
    throw new Error(`No execution rows were found in ${sourcePdf}.`);
  }

  rows.sort((left, right) =>
    left.tradeTime.localeCompare(right.tradeTime) ||
    left.orderNo.localeCompare(right.orderNo) ||
    left.tradeNo.localeCompare(right.tradeNo) ||
    left.sequence - right.sequence,
  );

  const summary =
    statementKind === "EQUITY" ? parseEquitySummary(layout, rows) : parseDerivativeSummary(layout);

  return {
    sourcePdf,
    statementKind,
    displayKind: toDisplayStatementKind(statementKind),
    statementPeriod,
    rows,
    summary,
    executionSignature: buildExecutionSignature(rows.map(executionRowIdentity)),
  };
}

export function parseInputLayouts(files: ParsedFileInput[]): {
  statements: ParsedStatement[];
  sourceManifest: SourceManifest;
} {
  const uniqueStatements: ParsedStatement[] = [];
  const seenBySignature = new Map<string, ParsedStatement>();
  const duplicatesIgnored: SourceManifest["duplicatesIgnored"] = [];

  for (const file of files) {
    const statement = parseStatementLayout(file.layout, file.file.name);
    const existing = seenBySignature.get(statement.executionSignature);

    if (existing) {
      duplicatesIgnored.push({
        duplicatePdf: statement.sourcePdf,
        duplicateOfPdf: existing.sourcePdf,
        statementKind: statement.statementKind,
      });
      continue;
    }

    seenBySignature.set(statement.executionSignature, statement);
    uniqueStatements.push(statement);
  }

  return {
    statements: uniqueStatements,
    sourceManifest: {
      inputPdfs: files.map((file) => file.file.name),
      uniqueStatements: uniqueStatements.map((statement) => ({
        pdf: statement.sourcePdf,
        statementKind: statement.statementKind,
        periodStart: statement.statementPeriod.start,
        periodEnd: statement.statementPeriod.end,
        executionRows: statement.rows.length,
      })),
      duplicatesIgnored,
    },
  };
}

export function settlementCloseTimeIso(expiryDate: string): string {
  return `${expiryDate} ${DEFAULT_SETTLEMENT_CLOSE_TIME}`;
}

export function buildSummaryIdentity(summary: SummaryTotals): string {
  return [
    precise(summary.totalBuyValue),
    precise(summary.totalSellValue),
    precise(summary.stt),
    precise(summary.transactionCharges),
    precise(summary.stampDuty),
    precise(summary.sebiFees),
  ].join("|");
}
