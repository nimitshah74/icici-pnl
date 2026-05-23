import type { DisplayStatementKind, StatementKind } from "../domain/models";
import { toDisplayStatementKind } from "../domain/statementKinds";
import { Decimal, ZERO } from "./decimal";
import {
  decimalToNumber,
  money,
  precise,
  boolString,
} from "./utils";
import {
  executionRowRowCost,
  executionRowSignedNetCashflow,
  openPositionRowCost,
  tradeNetPnlFull,
  tradeNetPnlRowCosts,
  tradeStatus,
} from "./derived";
import type {
  ExecutionRow,
  OpenPosition,
  ParsedStatement,
  ReconstructedTrade,
  SourceManifest,
  SummaryTotals,
} from "./models";
import { combineSummaries } from "./parsing/statementParser";
import { displayInstrument } from "./securities";

export interface ReconciliationReport {
  statement_period: { start: string; end: string };
  source_row_counts: {
    execution_rows: number;
    closed_or_resolved_trade_rows: number;
    unresolved_open_positions: number;
    unresolved_expired_positions: number;
  };
  pdf_summary_totals: {
    total_buy_value: string;
    total_sell_value: string;
    stt: string;
    transaction_charges: string;
    stamp_duty: string;
    sebi_fees: string;
  };
  computed_from_rows: {
    total_buy_value: string;
    total_sell_value: string;
    brokerage: string;
    gst: string;
    stt: string;
    signed_net_cashflow_from_row_net_amounts: string;
  };
  validation: {
    buy_total_matches_summary: boolean;
    sell_total_matches_summary: boolean;
    stt_reconciles_after_summary_adjustment: boolean;
  };
  trade_pnl: {
    gross_pnl_closed_only: string;
    gross_pnl_all_resolved: string;
    net_pnl_after_row_level_costs_closed_only: string;
    net_pnl_after_row_level_costs_all_resolved: string;
    net_pnl_after_all_statement_costs_all_resolved: string;
  };
  statement_level_costs_not_in_row_net_amounts: {
    summary_only_stt: string;
    transaction_charges: string;
    stamp_duty: string;
    sebi_fees: string;
    total_additional_costs: string;
  };
  notes: string[];
  sources?: {
    input_pdfs: string[];
    unique_statements: SourceManifest["uniqueStatements"];
    duplicates_ignored: SourceManifest["duplicatesIgnored"];
  };
}

export interface SegmentReports {
  combined: ReconciliationReport;
  fno: ReconciliationReport;
  commodity: ReconciliationReport;
  equity: ReconciliationReport;
}

export interface WorkbookDataPayload {
  reconciliation: ReconciliationReport;
  segment_reports: SegmentReports;
  monthly_pnl: Array<Record<string, string>>;
  closed_trades: Array<Record<string, string>>;
  open_positions: Array<Record<string, string>>;
  parsed_rows: Array<Record<string, string>>;
  source_manifest: SourceManifest;
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

export function executionRowsToCsv(rows: ExecutionRow[]) {
  return rows.map((row) => ({
    sequence: String(row.sequence),
    source_pdf: row.sourcePdf,
    statement_kind: row.statementKind,
    contract_number: row.contractNumber,
    exchange_code: row.exchangeCode,
    order_no: row.orderNo,
    order_time: row.orderTime,
    trade_no: row.tradeNo,
    trade_time: row.tradeTime,
    security: row.security.raw,
    symbol: row.security.symbol,
    instrument_kind: row.security.instrumentKind,
    family: row.security.family,
    market_kind: row.security.marketKind,
    expiry: row.security.expiry ?? "",
    option_type: row.security.optionType ?? "",
    strike: row.security.strike ? money(row.security.strike) : "",
    isin: row.security.isin ?? "",
    security_name: row.security.securityName ?? "",
    side: row.side,
    quantity: String(row.quantity),
    gross_rate: money(row.grossRate),
    total_value: money(row.totalValue),
    brokerage: money(row.brokerage),
    gst: money(row.gst),
    row_stt: money(row.rowStt),
    row_cost: precise(executionRowRowCost(row)),
    net_amount: money(row.netAmount),
    signed_net_cashflow: precise(executionRowSignedNetCashflow(row)),
  }));
}

export function tradesToCsv(trades: ReconstructedTrade[]) {
  return trades.map((trade) => ({
    match_id: String(trade.matchId),
    statement_kind: trade.statementKind,
    security: trade.security.raw,
    symbol: trade.security.symbol,
    instrument_kind: trade.security.instrumentKind,
    family: trade.security.family,
    market_kind: trade.security.marketKind,
    expiry: trade.security.expiry ?? "",
    option_type: trade.security.optionType ?? "",
    strike: trade.security.strike ? money(trade.security.strike) : "",
    isin: trade.security.isin ?? "",
    security_name: trade.security.securityName ?? "",
    instrument: displayInstrument(trade.security),
    position: trade.position,
    trade_style: trade.tradeStyle,
    opened_with: trade.openSide,
    closed_with: trade.closeSide,
    quantity: String(trade.quantity),
    open_time: trade.openTime,
    close_time: trade.closeTime ?? "",
    open_trade_no: trade.openTradeNo,
    close_trade_no: trade.closeTradeNo ?? "",
    open_rate: money(trade.openRate),
    close_rate: trade.closeRate ? money(trade.closeRate) : "",
    open_total_value: precise(trade.openTotalValue),
    close_total_value: precise(trade.closeTotalValue),
    buy_total_value: precise(trade.buyTotalValue),
    sell_total_value: precise(trade.sellTotalValue),
    gross_pnl: money(trade.grossPnl),
    allocated_brokerage: precise(trade.allocatedBrokerage),
    allocated_gst: precise(trade.allocatedGst),
    allocated_stt: precise(trade.allocatedStt),
    allocated_summary_only_stt: precise(trade.allocatedSummaryOnlyStt),
    allocated_transaction_charges: precise(trade.allocatedTransactionCharges),
    allocated_stamp_duty: precise(trade.allocatedStampDuty),
    allocated_sebi_fees: precise(trade.allocatedSebiFees),
    net_pnl_row_costs: precise(tradeNetPnlRowCosts(trade)),
    net_pnl_full: precise(tradeNetPnlFull(trade)),
    status: tradeStatus(trade),
    close_reason: trade.closeReason,
  }));
}

export function openPositionsToCsv(openPositions: OpenPosition[], statementEnd: string) {
  return openPositions.map((position) => ({
    statement_kind: position.statementKind,
    security: position.security.raw,
    symbol: position.security.symbol,
    instrument_kind: position.security.instrumentKind,
    family: position.security.family,
    market_kind: position.security.marketKind,
    expiry: position.security.expiry ?? "",
    expired_before_statement_end: position.security.expiry
      ? boolString(position.security.expiry <= statementEnd)
      : "",
    option_type: position.security.optionType ?? "",
    strike: position.security.strike ? money(position.security.strike) : "",
    isin: position.security.isin ?? "",
    security_name: position.security.securityName ?? "",
    instrument: displayInstrument(position.security),
    side: position.side,
    quantity: String(position.quantity),
    open_time: position.openTime,
    trade_no: position.tradeNo,
    open_rate: money(position.openRate),
    total_value: money(position.totalValue),
    brokerage: precise(position.brokerage),
    gst: precise(position.gst),
    stt: precise(position.stt),
    row_cost: precise(openPositionRowCost(position)),
    position_note: position.positionNote,
  }));
}

export function settlementTemplateRows(openPositions: OpenPosition[], statementEnd: string) {
  const seen = new Set<string>();
  const rows: Array<Record<string, string>> = [];

  for (const position of openPositions) {
    if (!position.security.expiry || seen.has(position.security.raw)) {
      continue;
    }

    seen.add(position.security.raw);
    rows.push({
      security: position.security.raw,
      expiry: position.security.expiry,
      expired_before_statement_end: boolString(position.security.expiry <= statementEnd),
      settlement_rate: "",
      notes: "Enter the final option/future settlement price per unit. Use 0 for worthless expiry.",
    });
  }

  return rows;
}

export function buildMonthlyPnlRows(trades: ReconstructedTrade[]) {
  const buckets = new Map<
    string,
    {
      grossPnl: typeof ZERO;
      netPnlRowCosts: typeof ZERO;
      netPnlFull: typeof ZERO;
      tradeCount: number;
      winningTrades: number;
      losingTrades: number;
      fnoNetPnlRowCosts: typeof ZERO;
      mcxNetPnlRowCosts: typeof ZERO;
      equityNetPnlRowCosts: typeof ZERO;
    }
  >();

  for (const trade of trades) {
    if (!trade.closeTime) {
      continue;
    }

    const month = trade.closeTime.slice(0, 7);
    const bucket =
      buckets.get(month) ??
      {
        grossPnl: ZERO,
        netPnlRowCosts: ZERO,
        netPnlFull: ZERO,
        tradeCount: 0,
        winningTrades: 0,
        losingTrades: 0,
        fnoNetPnlRowCosts: ZERO,
        mcxNetPnlRowCosts: ZERO,
        equityNetPnlRowCosts: ZERO,
      };

    bucket.grossPnl = bucket.grossPnl.add(trade.grossPnl);
    bucket.netPnlRowCosts = bucket.netPnlRowCosts.add(tradeNetPnlRowCosts(trade));
    bucket.netPnlFull = bucket.netPnlFull.add(tradeNetPnlFull(trade));
    bucket.tradeCount += 1;
    if (tradeNetPnlRowCosts(trade).greaterThan(0)) {
      bucket.winningTrades += 1;
    } else if (tradeNetPnlRowCosts(trade).lessThan(0)) {
      bucket.losingTrades += 1;
    }

    if (trade.statementKind === "MCX") {
      bucket.mcxNetPnlRowCosts = bucket.mcxNetPnlRowCosts.add(tradeNetPnlRowCosts(trade));
    } else if (trade.statementKind === "EQUITY") {
      bucket.equityNetPnlRowCosts = bucket.equityNetPnlRowCosts.add(tradeNetPnlRowCosts(trade));
    } else {
      bucket.fnoNetPnlRowCosts = bucket.fnoNetPnlRowCosts.add(tradeNetPnlRowCosts(trade));
    }

    buckets.set(month, bucket);
  }

  let previousNet = ZERO;
  let isFirstMonth = true;
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, bucket]) => {
      const momChange = isFirstMonth ? ZERO : bucket.netPnlRowCosts.sub(previousNet);
      isFirstMonth = false;
      previousNet = bucket.netPnlRowCosts;
      return {
        month,
        gross_pnl: money(bucket.grossPnl),
        net_pnl_row_costs: money(bucket.netPnlRowCosts),
        net_pnl_full: money(bucket.netPnlFull),
        fno_net_pnl_row_costs: money(bucket.fnoNetPnlRowCosts),
        mcx_net_pnl_row_costs: money(bucket.mcxNetPnlRowCosts),
        equity_net_pnl_row_costs: money(bucket.equityNetPnlRowCosts),
        trade_count: String(bucket.tradeCount),
        winning_trades: String(bucket.winningTrades),
        losing_trades: String(bucket.losingTrades),
        mom_change_net_pnl_row_costs: money(momChange),
      };
    });
}

export function buildReconciliation(
  rows: ExecutionRow[],
  trades: ReconstructedTrade[],
  openPositions: OpenPosition[],
  summary: SummaryTotals,
  statementPeriod: { start: string; end: string },
): ReconciliationReport {
  const buyTotalRows = rows.filter((row) => row.side === "B").reduce((sum, row) => sum.add(row.totalValue), ZERO);
  const sellTotalRows = rows.filter((row) => row.side === "S").reduce((sum, row) => sum.add(row.totalValue), ZERO);
  const brokerageTotalRows = rows.reduce((sum, row) => sum.add(row.brokerage), ZERO);
  const gstTotalRows = rows.reduce((sum, row) => sum.add(row.gst), ZERO);
  const sttTotalRows = rows.reduce((sum, row) => sum.add(row.rowStt), ZERO);
  const signedNetCashflow = rows.reduce((sum, row) => sum.add(executionRowSignedNetCashflow(row)), ZERO);
  const summaryOnlyStt = Decimal.max(summary.stt.sub(sttTotalRows), ZERO);
  const grossClosed = trades
    .filter((trade) => trade.closeReason === "TRADE")
    .reduce((sum, trade) => sum.add(trade.grossPnl), ZERO);
  const grossAllResolved = trades.reduce((sum, trade) => sum.add(trade.grossPnl), ZERO);
  const netRowClosed = trades
    .filter((trade) => trade.closeReason === "TRADE")
    .reduce((sum, trade) => sum.add(tradeNetPnlRowCosts(trade)), ZERO);
  const netRowAllResolved = trades.reduce((sum, trade) => sum.add(tradeNetPnlRowCosts(trade)), ZERO);
  const netFullAllResolved = trades.reduce((sum, trade) => sum.add(tradeNetPnlFull(trade)), ZERO);
  const unresolvedExpired = openPositions.filter(
    (position) => position.security.expiry && position.security.expiry <= statementPeriod.end,
  );

  return {
    statement_period: statementPeriod,
    source_row_counts: {
      execution_rows: rows.length,
      closed_or_resolved_trade_rows: trades.length,
      unresolved_open_positions: openPositions.length,
      unresolved_expired_positions: unresolvedExpired.length,
    },
    pdf_summary_totals: {
      total_buy_value: money(summary.totalBuyValue),
      total_sell_value: money(summary.totalSellValue),
      stt: money(summary.stt),
      transaction_charges: money(summary.transactionCharges),
      stamp_duty: money(summary.stampDuty),
      sebi_fees: money(summary.sebiFees),
    },
    computed_from_rows: {
      total_buy_value: money(buyTotalRows),
      total_sell_value: money(sellTotalRows),
      brokerage: money(brokerageTotalRows),
      gst: money(gstTotalRows),
      stt: money(sttTotalRows),
      signed_net_cashflow_from_row_net_amounts: money(signedNetCashflow),
    },
    validation: {
      buy_total_matches_summary: buyTotalRows.eq(summary.totalBuyValue),
      sell_total_matches_summary: sellTotalRows.eq(summary.totalSellValue),
      stt_reconciles_after_summary_adjustment: sttTotalRows.add(summaryOnlyStt).sub(summary.stt).abs().lessThanOrEqualTo(0.01),
    },
    trade_pnl: {
      gross_pnl_closed_only: money(grossClosed),
      gross_pnl_all_resolved: money(grossAllResolved),
      net_pnl_after_row_level_costs_closed_only: money(netRowClosed),
      net_pnl_after_row_level_costs_all_resolved: money(netRowAllResolved),
      net_pnl_after_all_statement_costs_all_resolved: money(netFullAllResolved),
    },
    statement_level_costs_not_in_row_net_amounts: {
      summary_only_stt: money(summaryOnlyStt),
      transaction_charges: money(summary.transactionCharges),
      stamp_duty: money(summary.stampDuty),
      sebi_fees: money(summary.sebiFees),
      total_additional_costs: money(
        summaryOnlyStt.add(summary.transactionCharges).add(summary.stampDuty).add(summary.sebiFees),
      ),
    },
    notes: [
      "Trade reconstruction uses FIFO matching within each exact contract symbol.",
      "Gross and row-level net trade P&L come only from the PDF rows themselves.",
      "Summary transaction charges, stamp duty, and SEBI fees are allocated proportionally so the trade-level fully-loaded total can reconcile to the statement.",
      "If unresolved positions remain open or expired without settlement rates, the final realized trade P&L is incomplete by design.",
    ],
  };
}

function sourceManifestForKind(sourceManifest: SourceManifest, statementKind: StatementKind) {
  return {
    input_pdfs: sourceManifest.uniqueStatements
      .filter((item) => item.statementKind === statementKind)
      .map((item) => item.pdf),
    unique_statements: sourceManifest.uniqueStatements.filter(
      (item) => item.statementKind === statementKind,
    ),
    duplicates_ignored: sourceManifest.duplicatesIgnored.filter(
      (item) => item.statementKind === statementKind,
    ),
  };
}

export function buildSegmentReport(
  statementKind: StatementKind,
  statements: ParsedStatement[],
  rows: ExecutionRow[],
  trades: ReconstructedTrade[],
  openPositions: OpenPosition[],
  sourceManifest: SourceManifest,
) {
  const segmentStatements = statements.filter((statement) => statement.statementKind === statementKind);
  const segmentRows = rows.filter((row) => row.statementKind === statementKind);
  const segmentTrades = trades.filter((trade) => trade.statementKind === statementKind);
  const segmentOpenPositions = openPositions.filter((position) => position.statementKind === statementKind);

  const statementPeriod = segmentStatements.length
    ? {
        start: segmentStatements.reduce((min, statement) => (statement.statementPeriod.start < min ? statement.statementPeriod.start : min), segmentStatements[0].statementPeriod.start),
        end: segmentStatements.reduce((max, statement) => (statement.statementPeriod.end > max ? statement.statementPeriod.end : max), segmentStatements[0].statementPeriod.end),
      }
    : { start: "", end: "" };
  const summary = segmentStatements.length
    ? combineSummaries(segmentStatements.map((statement) => statement.summary))
    : emptySummaryTotals();
  const report = buildReconciliation(segmentRows, segmentTrades, segmentOpenPositions, summary, statementPeriod);
  report.sources = sourceManifestForKind(sourceManifest, statementKind);
  return report;
}

export function buildMarkdownReport(
  reconciliation: ReconciliationReport,
  trades: ReconstructedTrade[],
  openPositions: OpenPosition[],
) {
  const monthlyRows = buildMonthlyPnlRows(trades);
  const lines: string[] = [];
  lines.push("# ICICI Combined Trading P&L Report", "");
  lines.push(
    `Statement period: ${reconciliation.statement_period.start} to ${reconciliation.statement_period.end}`,
    "",
  );
  lines.push("## Validation", "");
  lines.push(`- Execution rows parsed: ${reconciliation.source_row_counts.execution_rows}`);
  lines.push(
    `- Reconstructed closed/resolved trades: ${reconciliation.source_row_counts.closed_or_resolved_trade_rows}`,
  );
  lines.push(`- Unresolved open positions: ${reconciliation.source_row_counts.unresolved_open_positions}`);
  lines.push(
    `- Buy traded value matches PDF summary: ${reconciliation.validation.buy_total_matches_summary}`,
  );
  lines.push(
    `- Sell traded value matches PDF summary: ${reconciliation.validation.sell_total_matches_summary}`,
  );
  lines.push(
    `- STT reconciles to PDF summary after summary-level adjustment: ${reconciliation.validation.stt_reconciles_after_summary_adjustment}`,
    "",
  );
  lines.push("## Trade P&L", "");
  lines.push(`- Gross P&L for closed trades: ${reconciliation.trade_pnl.gross_pnl_closed_only}`);
  lines.push(
    `- Net P&L after row-level costs for closed trades: ${reconciliation.trade_pnl.net_pnl_after_row_level_costs_closed_only}`,
  );
  lines.push(
    `- Net P&L after all statement costs for all resolved trades: ${reconciliation.trade_pnl.net_pnl_after_all_statement_costs_all_resolved}`,
    "",
  );

  if (monthlyRows.length > 0) {
    lines.push("## Month Over Month P&L", "");
    for (const row of monthlyRows) {
      lines.push(
        `- ${row.month}: net row-cost P&L ${row.net_pnl_row_costs} (MoM change ${row.mom_change_net_pnl_row_costs}, trades ${row.trade_count})`,
      );
    }
    lines.push("");
  }

  if (openPositions.length > 0) {
    lines.push("## Unresolved Positions", "");
    for (const position of openPositions) {
      lines.push(
        `- ${position.security.symbol} ${displayInstrument(position.security)} ${position.side} qty ${position.quantity} opened ${position.openTime} at ${money(position.openRate)}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildWorkbookPayload(
  statements: ParsedStatement[],
  rows: ExecutionRow[],
  trades: ReconstructedTrade[],
  openPositions: OpenPosition[],
  sourceManifest: SourceManifest,
  summary: SummaryTotals,
  statementPeriod: { start: string; end: string },
): WorkbookDataPayload {
  const reconciliation = buildReconciliation(rows, trades, openPositions, summary, statementPeriod);
  reconciliation.sources = {
    input_pdfs: sourceManifest.inputPdfs,
    unique_statements: sourceManifest.uniqueStatements,
    duplicates_ignored: sourceManifest.duplicatesIgnored,
  };

  return {
    reconciliation,
    segment_reports: {
      combined: reconciliation,
      fno: buildSegmentReport("FNO", statements, rows, trades, openPositions, sourceManifest),
      commodity: buildSegmentReport("MCX", statements, rows, trades, openPositions, sourceManifest),
      equity: buildSegmentReport("EQUITY", statements, rows, trades, openPositions, sourceManifest),
    },
    monthly_pnl: buildMonthlyPnlRows(trades),
    closed_trades: tradesToCsv(trades),
    open_positions: openPositionsToCsv(openPositions, statementPeriod.end),
    parsed_rows: executionRowsToCsv(rows),
    source_manifest: sourceManifest,
  };
}

export function toDisplayKind(kind: StatementKind): DisplayStatementKind {
  return toDisplayStatementKind(kind);
}

export function metricsFromWorkbookPayload(payload: WorkbookDataPayload) {
  return {
    executionRows: payload.parsed_rows.length,
    closedTrades: payload.closed_trades.length,
    unresolvedPositions: payload.open_positions.length,
    grossPnl: decimalToNumber(toDecimalSafe(payload.reconciliation.trade_pnl.gross_pnl_closed_only)),
    netPnl: decimalToNumber(
      toDecimalSafe(payload.reconciliation.trade_pnl.net_pnl_after_all_statement_costs_all_resolved),
    ),
  };
}

function toDecimalSafe(value: string) {
  return ZERO.add(value);
}
