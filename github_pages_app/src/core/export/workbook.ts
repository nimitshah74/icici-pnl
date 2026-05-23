import ExcelJS from "exceljs";

import type { WorkbookDataPayload } from "../reporting";

const POSITIVE_FILL = "DCFCE7";
const POSITIVE_FONT = "166534";
const NEGATIVE_FILL = "FEE2E2";
const NEGATIVE_FONT = "991B1B";

function isNumericLike(value: string | number | boolean | null | undefined): value is string | number {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  return /^-?\d+(?:\.\d+)?$/.test(value);
}

function numericValue(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function applyHeaderStyle(row: ExcelJS.Row, fill = "0F5C73") {
  row.eachCell((cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${fill}` },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });
}

function applyBodyBorders(row: ExcelJS.Row) {
  row.eachCell((cell: ExcelJS.Cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });
}

function applyPnlStyle(cell: ExcelJS.Cell, value: string | number | null | undefined) {
  if (!isNumericLike(value)) {
    return;
  }

  const amount = numericValue(value);
  cell.numFmt = "0.00";
  if (amount > 0) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${POSITIVE_FILL}` } };
    cell.font = { color: { argb: `FF${POSITIVE_FONT}` }, bold: true };
  } else if (amount < 0) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${NEGATIVE_FILL}` } };
    cell.font = { color: { argb: `FF${NEGATIVE_FONT}` }, bold: true };
  }
}

function setAutoWidths(worksheet: ExcelJS.Worksheet) {
  worksheet.columns.forEach((column: Partial<ExcelJS.Column>) => {
    if (!column.eachCell) {
      return;
    }
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
      const value = cell.value == null ? "" : String(cell.value);
      maxLength = Math.max(maxLength, value.length);
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 42);
  });
}

function writeRecordsTable(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  headers: string[],
  rows: Array<Record<string, string>>,
  headerFill?: string,
  startColumn = 1,
) {
  const headerRow = worksheet.getRow(startRow);
  headers.forEach((header, index) => {
    headerRow.getCell(startColumn + index).value = header;
  });
  applyHeaderStyle(headerRow, headerFill);

  rows.forEach((entry, index) => {
    const row = worksheet.getRow(startRow + index + 1);
    headers.forEach((header, headerIndex) => {
      const value = entry[header] ?? "";
      row.getCell(startColumn + headerIndex).value = isNumericLike(value) ? Number(value) : value;
    });
    applyBodyBorders(row);
  });

  return startRow + rows.length;
}

function writeTitle(worksheet: ExcelJS.Worksheet, title: string, columns: number) {
  worksheet.mergeCells(1, 1, 1, columns);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5C73" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 24;
}

function writeSummarySheet(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  report: WorkbookDataPayload["reconciliation"],
) {
  const worksheet = workbook.addWorksheet(name);
  writeTitle(worksheet, title, 8);

  const metricRows = [
    { Metric: "Statement period", Value: `${report.statement_period.start} to ${report.statement_period.end}` },
    { Metric: "Execution rows", Value: String(report.source_row_counts.execution_rows) },
    { Metric: "Closed/resolved trades", Value: String(report.source_row_counts.closed_or_resolved_trade_rows) },
    { Metric: "Unresolved open positions", Value: String(report.source_row_counts.unresolved_open_positions) },
    { Metric: "Gross P&L (closed)", Value: report.trade_pnl.gross_pnl_closed_only },
    { Metric: "Net P&L row costs (closed)", Value: report.trade_pnl.net_pnl_after_row_level_costs_closed_only },
    { Metric: "Net P&L fully loaded", Value: report.trade_pnl.net_pnl_after_all_statement_costs_all_resolved },
    { Metric: "Summary-only STT/CTT", Value: report.statement_level_costs_not_in_row_net_amounts.summary_only_stt },
  ];

  writeRecordsTable(worksheet, 3, ["Metric", "Value"], metricRows, "0F5C73", 1);
  for (let rowIndex = 7; rowIndex <= 9; rowIndex += 1) {
    applyPnlStyle(worksheet.getCell(`B${rowIndex}`), worksheet.getCell(`B${rowIndex}`).value as number);
  }

  const validationRows = [
    { Check: "Buy traded value matches", Result: String(report.validation.buy_total_matches_summary) },
    { Check: "Sell traded value matches", Result: String(report.validation.sell_total_matches_summary) },
    {
      Check: "STT reconciles after summary adjustment",
      Result: String(report.validation.stt_reconciles_after_summary_adjustment),
    },
  ];
  writeRecordsTable(worksheet, 3, ["Check", "Result"], validationRows, "D97706", 4);
  for (let rowIndex = 4; rowIndex <= 6; rowIndex += 1) {
    const cell = worksheet.getCell(`E${rowIndex}`);
    const success = String(cell.value).toLowerCase() === "true";
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: success ? `FF${POSITIVE_FILL}` : `FF${NEGATIVE_FILL}` },
    };
    cell.font = { color: { argb: success ? `FF${POSITIVE_FONT}` : `FF${NEGATIVE_FONT}` }, bold: true };
  }

  const sourceRows = [
    ...(report.sources?.unique_statements ?? []).map((item) => ({
      Type: "Used",
      Kind: item.statementKind === "MCX" ? "COMMODITY" : item.statementKind,
      PDF: item.pdf,
      Rows: String(item.executionRows),
    })),
    ...(report.sources?.duplicates_ignored ?? []).map((item) => ({
      Type: "Ignored duplicate",
      Kind: item.statementKind === "MCX" ? "COMMODITY" : item.statementKind,
      PDF: item.duplicatePdf,
      Rows: "",
    })),
  ];
  writeRecordsTable(worksheet, 14, ["Type", "Kind", "PDF", "Rows"], sourceRows, "047857", 1);
  setAutoWidths(worksheet);
}

function writeMonthlySheet(workbook: ExcelJS.Workbook, payload: WorkbookDataPayload) {
  const worksheet = workbook.addWorksheet("Monthly PnL");
  writeTitle(worksheet, "Month Over Month P&L", 11);
  const rows = payload.monthly_pnl;
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    const endRow = writeRecordsTable(worksheet, 3, headers, rows, "6D28D9");
    for (let rowIndex = 4; rowIndex <= endRow; rowIndex += 1) {
      for (const column of ["B", "C", "D", "E", "F", "G", "K"]) {
        applyPnlStyle(worksheet.getCell(`${column}${rowIndex}`), worksheet.getCell(`${column}${rowIndex}`).value as number);
      }
    }
  }
  setAutoWidths(worksheet);
}

function writeClosedTradesSheet(workbook: ExcelJS.Workbook, payload: WorkbookDataPayload) {
  const worksheet = workbook.addWorksheet("Closed Trades");
  writeTitle(worksheet, "Closed Trades", 18);
  const rows = payload.closed_trades;
  if (rows.length === 0) {
    return;
  }

  const headers = Object.keys(rows[0]);
  const endRow = writeRecordsTable(worksheet, 3, headers, rows, "7C3AED");

  const pnlColumns = ["gross_pnl", "net_pnl_row_costs", "net_pnl_full"];
  for (let rowIndex = 4; rowIndex <= endRow; rowIndex += 1) {
    for (const field of pnlColumns) {
      const columnIndex = headers.indexOf(field) + 1;
      if (columnIndex > 0) {
        applyPnlStyle(worksheet.getRow(rowIndex).getCell(columnIndex), worksheet.getRow(rowIndex).getCell(columnIndex).value as number);
      }
    }
  }

  const totalBuy = Number(payload.reconciliation.pdf_summary_totals.total_buy_value);
  const totalSell = Number(payload.reconciliation.pdf_summary_totals.total_sell_value);
  const totalAmountTraded = totalBuy + totalSell;
  const gross = rows.reduce((sum, row) => sum + Number(row.gross_pnl), 0);
  const net = rows.reduce((sum, row) => sum + Number(row.net_pnl_full), 0);
  const brokerage = rows.reduce((sum, row) => sum + Number(row.allocated_brokerage), 0);
  const gst = rows.reduce((sum, row) => sum + Number(row.allocated_gst), 0);
  const stt = rows.reduce((sum, row) => sum + Number(row.allocated_stt) + Number(row.allocated_summary_only_stt), 0);
  const sebi = rows.reduce((sum, row) => sum + Number(row.allocated_sebi_fees), 0);
  const stamp = rows.reduce((sum, row) => sum + Number(row.allocated_stamp_duty), 0);
  const fees = rows.reduce(
    (sum, row) =>
      sum +
      Number(row.allocated_brokerage) +
      Number(row.allocated_gst) +
      Number(row.allocated_stt) +
      Number(row.allocated_summary_only_stt) +
      Number(row.allocated_transaction_charges) +
      Number(row.allocated_stamp_duty) +
      Number(row.allocated_sebi_fees),
    0,
  );
  const profits = rows.filter((row) => Number(row.net_pnl_full) > 0).length;
  const losses = rows.filter((row) => Number(row.net_pnl_full) < 0).length;
  const hitRatio = rows.length > 0 ? profits / rows.length : 0;
  const feesPct = totalAmountTraded > 0 ? fees / totalAmountTraded : 0;
  const symbolCounts = new Map<string, number>();
  rows.forEach((row) => {
    symbolCounts.set(row.symbol, (symbolCounts.get(row.symbol) ?? 0) + 1);
  });
  const [mostTradedSymbol = "", mostTradedCount = 0] =
    [...symbolCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ?? [];

  const totalsRows = [
    { Metric: "Total gross pnl", Value: gross },
    { Metric: "Total net pnl", Value: net },
    { Metric: "Total profit making trades", Value: profits },
    { Metric: "Total loss making trades", Value: losses },
    { Metric: "Total allocated brokerage", Value: brokerage },
    { Metric: "Total GST", Value: gst },
    { Metric: "Total STT", Value: stt },
    { Metric: "Total allocated sebi fees", Value: sebi },
    { Metric: "Total stamp duty", Value: stamp },
    { Metric: "Total extra charges", Value: fees },
    { Metric: "Fees as % of total amount traded", Value: feesPct },
    { Metric: "Hit ratio", Value: hitRatio },
    { Metric: "Most traded symbol", Value: `${mostTradedSymbol} (${mostTradedCount})` },
  ];
  const totalsStart = endRow + 3;
  writeRecordsTable(
    worksheet,
    totalsStart,
    ["Metric", "Value"],
    totalsRows.map((row) => ({
      Metric: row.Metric,
      Value: typeof row.Value === "number" ? String(row.Value) : row.Value,
    })),
    "0F5C73",
  );
  applyPnlStyle(worksheet.getCell(`B${totalsStart + 1}`), gross);
  applyPnlStyle(worksheet.getCell(`B${totalsStart + 2}`), net);
  worksheet.getCell(`B${totalsStart + 11}`).numFmt = "0.00%";
  worksheet.getCell(`B${totalsStart + 12}`).numFmt = "0.00%";

  const topProfitStart = totalsStart + totalsRows.length + 3;
  const topProfitTrades = [...rows]
    .filter((row) => Number(row.net_pnl_full) > 0)
    .sort((left, right) => Number(right.net_pnl_full) - Number(left.net_pnl_full))
    .slice(0, 3);
  const topLossTrades = [...rows]
    .filter((row) => Number(row.net_pnl_full) < 0)
    .sort((left, right) => Number(left.net_pnl_full) - Number(right.net_pnl_full))
    .slice(0, 3);
  worksheet.mergeCells(topProfitStart, 4, topProfitStart, 9);
  worksheet.getCell(topProfitStart, 4).value = "Top 3 Profit-Making Trades";
  applyHeaderStyle(worksheet.getRow(topProfitStart), "2563EB");
  writeRecordsTable(worksheet, topProfitStart + 1, ["symbol", "instrument", "position", "quantity", "gross_pnl", "net_pnl_full"], topProfitTrades, "D97706");

  const topLossStart = topProfitStart + 6;
  worksheet.mergeCells(topLossStart, 4, topLossStart, 9);
  worksheet.getCell(topLossStart, 4).value = "Top 3 Loss-Making Trades";
  applyHeaderStyle(worksheet.getRow(topLossStart), "B91C1C");
  writeRecordsTable(worksheet, topLossStart + 1, ["symbol", "instrument", "position", "quantity", "gross_pnl", "net_pnl_full"], topLossTrades, "DC2626");
  setAutoWidths(worksheet);
}

function writeSimpleDataSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  rows: Array<Record<string, string>>,
  headerFill: string,
) {
  const worksheet = workbook.addWorksheet(sheetName);
  writeTitle(worksheet, title, rows[0] ? Object.keys(rows[0]).length : 6);
  if (rows.length > 0) {
    writeRecordsTable(worksheet, 3, Object.keys(rows[0]), rows, headerFill);
  }
  setAutoWidths(worksheet);
}

function writeSourcesSheet(workbook: ExcelJS.Workbook, payload: WorkbookDataPayload) {
  const worksheet = workbook.addWorksheet("Sources");
  writeTitle(worksheet, "Input Statements", 6);
  const rows = [
    ...payload.source_manifest.uniqueStatements.map((item) => ({
      type: "Used",
      statement_kind: item.statementKind === "MCX" ? "COMMODITY" : item.statementKind,
      pdf: item.pdf,
      period_start: item.periodStart,
      period_end: item.periodEnd,
      execution_rows: String(item.executionRows),
    })),
    ...payload.source_manifest.duplicatesIgnored.map((item) => ({
      type: "Ignored duplicate",
      statement_kind: item.statementKind === "MCX" ? "COMMODITY" : item.statementKind,
      pdf: item.duplicatePdf,
      period_start: "",
      period_end: "",
      execution_rows: "",
    })),
  ];
  if (rows.length > 0) {
    writeRecordsTable(worksheet, 3, Object.keys(rows[0]), rows, "047857");
  }
  setAutoWidths(worksheet);
}

export async function buildWorkbookBlob(payload: WorkbookDataPayload) {
  const workbook = new ExcelJS.Workbook();
  writeSummarySheet(workbook, "Combined", "Combined Trading P&L", payload.segment_reports.combined);
  writeSummarySheet(workbook, "FNO", "F&O Trading P&L", payload.segment_reports.fno);
  writeSummarySheet(workbook, "Commodity", "Commodity Trading P&L", payload.segment_reports.commodity);
  writeSummarySheet(workbook, "Equity", "Equity Trading P&L", payload.segment_reports.equity);
  writeMonthlySheet(workbook, payload);
  writeClosedTradesSheet(workbook, payload);
  writeSimpleDataSheet(workbook, "Open Positions", "Open Positions", payload.open_positions, "991B1B");
  writeSimpleDataSheet(workbook, "Parsed Rows", "Parsed Execution Rows", payload.parsed_rows, "D97706");
  writeSourcesSheet(workbook, payload);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
