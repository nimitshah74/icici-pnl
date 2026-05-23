import { describe, expect, it } from "vitest";

import { ZERO, toDecimal } from "../src/core/decimal";
import { parseStatementLayout, parseInputLayouts } from "../src/core/parsing/statementParser";
import type { PdfDocumentLayout, PdfLayoutLine, ReconstructedTrade } from "../src/core/models";
import { parseSecurity } from "../src/core/securities";
import { allocateSummaryCosts, reconstructTrades } from "../src/core/reconstruction";
import { buildMonthlyPnlRows } from "../src/core/reporting";

function line(
  y: number,
  parts: Array<{ text: string; x: number }>,
): PdfLayoutLine {
  return {
    y,
    text: parts.map((part) => part.text).join(" "),
    items: parts.map((part) => ({
      text: part.text,
      x: part.x,
      y,
      width: 10,
    })),
  };
}

function derivativeLayout(): PdfDocumentLayout {
  const page1Lines = [
    line(940, [{ text: "Derivatives Transaction Statement from 01-Apr-2025 to 31-Mar-2026", x: 300 }]),
    line(903, [
      { text: "ISEC/202526/8346735", x: 37 },
      { text: "24-02-2026", x: 245 },
      { text: "24-02-2026", x: 334 },
      { text: "@HDFCBANK-OPTSTK-30MAR2026-PE-", x: 385 },
    ]),
    line(899, [
      { text: "NSE", x: 126 },
      { text: "2200000045485418", x: 162 },
      { text: "302268", x: 294 },
      { text: "S", x: 536 },
      { text: "550", x: 559 },
      { text: "4.25", x: 623 },
      { text: "480837.50", x: 669 },
      { text: "49.00", x: 732 },
      { text: "8.97", x: 780 },
      { text: "480777.53", x: 837 },
    ]),
    line(895, [
      { text: "10:14:28", x: 251 },
      { text: "10:14:28", x: 340 },
      { text: "870.00", x: 441 },
    ]),
    line(882, [
      { text: "ISEC/202526/8459882", x: 37 },
      { text: "27-02-2026", x: 245 },
      { text: "27-02-2026", x: 334 },
      { text: "@HDFCBANK-OPTSTK-30MAR2026-PE-", x: 385 },
    ]),
    line(878, [
      { text: "NSE", x: 126 },
      { text: "2200000032712901", x: 162 },
      { text: "131995", x: 294 },
      { text: "B", x: 536 },
      { text: "550", x: 559 },
      { text: "8.50", x: 623 },
      { text: "483175.00", x: 669 },
      { text: "49.00", x: 732 },
      { text: "9.12", x: 780 },
      { text: "483233.12", x: 837 },
    ]),
    line(874, [
      { text: "10:07:22", x: 251 },
      { text: "10:07:22", x: 340 },
      { text: "870.00", x: 441 },
    ]),
  ];
  const summaryPage = [
    line(100, [{ text: "Summary", x: 20 }]),
    line(80, [{ text: "Total 483175.00 480837.50 1.00 15.00 0.10 0.01", x: 20 }]),
  ];

  return {
    pageCount: 2,
    firstPageText: page1Lines.map((entry) => entry.text).join("\n"),
    scannedText: [...page1Lines, ...summaryPage].map((entry) => entry.text).join("\n"),
    pages: [
      { pageNumber: 1, lines: page1Lines, text: page1Lines.map((entry) => entry.text).join("\n") },
      { pageNumber: 2, lines: summaryPage, text: summaryPage.map((entry) => entry.text).join("\n") },
    ],
  };
}

function equityLayout(): PdfDocumentLayout {
  const page1Lines = [
    line(940, [{ text: "Equity Transaction Statement from 01-Apr-2025 to 31-Mar-2026", x: 280 }]),
    line(891, [
      { text: "ISEC/2025139/01097", x: 10 },
      { text: "22-07-2025", x: 264 },
      { text: "22-07-2025", x: 355 },
    ]),
    line(887, [
      { text: "2025139", x: 94 },
      { text: "NSE", x: 151 },
      { text: "1100000033898663", x: 184 },
      { text: "204020934", x: 308 },
      { text: "23-07-2025", x: 402 },
      { text: "INE758E01017", x: 452 },
      { text: "JIO FIN SERVICES LTD", x: 516 },
      { text: "B", x: 607 },
      { text: "114", x: 630 },
      { text: "311.50", x: 677 },
      { text: "35511.00", x: 724 },
      { text: "88.78", x: 776 },
      { text: "16.18", x: 816 },
      { text: "35615.96", x: 876 },
    ]),
    line(883, [
      { text: "0289", x: 36 },
      { text: "11:42:00", x: 270 },
      { text: "11:50", x: 365 },
    ]),
  ];
  const summaryPage = [
    line(100, [{ text: "Summary", x: 20 }]),
    line(80, [
      {
        text: "23-03-2026 ISEC/2026056/0369373 2026056 24-03-2026 22 0.66 0.00 Net amount receivable by Client Rs. 21518.15",
        x: 20,
      },
    ]),
  ];

  return {
    pageCount: 2,
    firstPageText: page1Lines.map((entry) => entry.text).join("\n"),
    scannedText: [...page1Lines, ...summaryPage].map((entry) => entry.text).join("\n"),
    pages: [
      { pageNumber: 1, lines: page1Lines, text: page1Lines.map((entry) => entry.text).join("\n") },
      { pageNumber: 2, lines: summaryPage, text: summaryPage.map((entry) => entry.text).join("\n") },
    ],
  };
}

function legacyMcxLayout(): PdfDocumentLayout {
  const page1Lines = [
    line(940, [{ text: "Commodity Derivatives Transaction Statement from 01-Jan-2026 to 31-Mar-2026", x: 206 }]),
    line(803, [
      { text: "23-03-2026", x: 223 },
      { text: "260066640", x: 266 },
      { text: "23-03-2026", x: 312 },
      { text: "NATGASMINI-OPTFUT-23APR2026-CE-", x: 364 },
    ]),
    line(799, [
      { text: "MCO/2026/1745585", x: 18 },
      { text: "MCO", x: 103 },
      { text: "608226324160533", x: 143 },
      { text: "S", x: 514 },
      { text: "250", x: 537 },
      { text: "22.00", x: 597 },
      { text: "80500.00", x: 652 },
      { text: "20.00", x: 710 },
      { text: "4.02", x: 758 },
      { text: "80475.98", x: 820 },
    ]),
    line(795, [
      { text: "09:55:19", x: 229 },
      { text: "09:55:19", x: 318 },
      { text: "300.00", x: 419 },
    ]),
    line(782, [
      { text: "23-03-2026", x: 223 },
      { text: "260066812", x: 266 },
      { text: "23-03-2026", x: 312 },
      { text: "NATGASMINI-OPTFUT-23APR2026-CE-", x: 364 },
    ]),
    line(778, [
      { text: "MCO/2026/1745585", x: 18 },
      { text: "MCO", x: 103 },
      { text: "608226324160533", x: 143 },
      { text: "S", x: 514 },
      { text: "250", x: 537 },
      { text: "22.00", x: 597 },
      { text: "80500.00", x: 652 },
      { text: "0.00", x: 714 },
      { text: "0.42", x: 758 },
      { text: "80499.58", x: 820 },
    ]),
    line(774, [
      { text: "09:55:40", x: 229 },
      { text: "09:55:40", x: 318 },
      { text: "300.00", x: 419 },
    ]),
  ];
  const summaryPage = [
    line(120, [{ text: "Summary", x: 20 }]),
    line(100, [{ text: "Total 169125.00 161000.00 15.00 14.44 0.12 0.03", x: 20 }]),
  ];

  return {
    pageCount: 1,
    firstPageText: page1Lines.map((entry) => entry.text).join("\n"),
    scannedText: [...page1Lines, ...summaryPage].map((entry) => entry.text).join("\n"),
    pages: [{ pageNumber: 1, lines: [...page1Lines, ...summaryPage], text: [...page1Lines, ...summaryPage].map((entry) => entry.text).join("\n") }],
  };
}

describe("core engine", () => {
  it("parses derivative option contracts", () => {
    const security = parseSecurity("@HDFCBANK-OPTSTK-30MAR2026-PE-870.00");
    expect(security.symbol).toBe("HDFCBANK");
    expect(security.instrumentKind).toBe("OPTION");
    expect(security.optionType).toBe("PE");
    expect(security.expiry).toBe("2026-03-30");
    expect(security.strike?.toFixed(2)).toBe("870.00");
  });

  it("parses derivative statements from browser layout blocks", () => {
    const statement = parseStatementLayout(derivativeLayout(), "TRX-FNO.pdf");
    expect(statement.statementKind).toBe("FNO");
    expect(statement.rows).toHaveLength(2);
    expect(statement.rows[0].security.symbol).toBe("HDFCBANK");
    expect(statement.rows[0].rowStt.toFixed(2)).toBe("2.00");
    expect(statement.summary.totalBuyValue.toFixed(2)).toBe("483175.00");
    expect(statement.summary.totalSellValue.toFixed(2)).toBe("480837.50");
  });

  it("parses legacy MCX layouts with date-led prelude lines", () => {
    const statement = parseStatementLayout(legacyMcxLayout(), "TRX-MCX.pdf");
    expect(statement.statementKind).toBe("MCX");
    expect(statement.rows).toHaveLength(2);
    expect(statement.rows[0].contractNumber).toBe("MCO/2026/1745585");
    expect(statement.rows[0].tradeNo).toBe("260066640");
    expect(statement.rows[0].security.raw).toBe("NATGASMINI-OPTFUT-23APR2026-CE-300.00");
    expect(statement.rows[1].brokerage.toFixed(2)).toBe("0.00");
  });

  it("parses equity statements from browser layout blocks", () => {
    const statement = parseStatementLayout(equityLayout(), "TRX-EQUITY.pdf");
    expect(statement.statementKind).toBe("EQUITY");
    expect(statement.rows).toHaveLength(1);
    expect(statement.rows[0].security.isin).toBe("INE758E01017");
    expect(statement.rows[0].security.symbol).toBe("JIO FIN SERVICES LTD");
    expect(statement.summary.stt.toFixed(2)).toBe("22.00");
    expect(statement.summary.transactionCharges.toFixed(2)).toBe("0.66");
  });

  it("deduplicates statements by execution signature", () => {
    const fileA = new File(["a"], "one.pdf", { type: "application/pdf" });
    const fileB = new File(["b"], "two.pdf", { type: "application/pdf" });
    const parsed = parseInputLayouts([
      { file: fileA, layout: derivativeLayout() },
      { file: fileB, layout: derivativeLayout() },
    ]);

    expect(parsed.statements).toHaveLength(1);
    expect(parsed.sourceManifest.duplicatesIgnored).toHaveLength(1);
    expect(parsed.sourceManifest.duplicatesIgnored[0].duplicatePdf).toBe("two.pdf");
  });

  it("reconstructs the HDFCBANK short option example correctly", () => {
    const statement = parseStatementLayout(derivativeLayout(), "TRX-FNO.pdf");
    const { trades, openPositions } = reconstructTrades(statement.rows);

    expect(openPositions).toHaveLength(0);
    expect(trades).toHaveLength(1);
    expect(trades[0].position).toBe("SHORT");
    expect(trades[0].tradeStyle).toBe("POSITIONAL");
    expect(trades[0].grossPnl.toFixed(2)).toBe("-2337.50");
  });

  it("marks same-day equity sell-buy pairs as intraday", () => {
    const statement = parseStatementLayout(equityLayout(), "TRX-EQUITY.pdf");
    const sellRow = {
      ...statement.rows[0],
      side: "S" as const,
      tradeNo: "200000001",
      netAmount: toDecimal("35422.18"),
      rowStt: ZERO,
    };
    const buyRow = {
      ...statement.rows[0],
      side: "B" as const,
      tradeNo: "200000002",
      tradeTime: "2025-07-22 11:55:00",
      netAmount: toDecimal("35615.96"),
      rowStt: ZERO,
    };

    const { trades, openPositions } = reconstructTrades([sellRow, buyRow]);
    expect(openPositions).toHaveLength(0);
    expect(trades).toHaveLength(1);
    expect(trades[0].tradeStyle).toBe("INTRADAY");
    expect(trades[0].position).toBe("SHORT");
  });

  it("builds month buckets after allocating summary costs", () => {
    const statement = parseStatementLayout(derivativeLayout(), "TRX-FNO.pdf");
    const { trades } = reconstructTrades(statement.rows);
    allocateSummaryCosts(trades, statement.summary);
    const monthly = buildMonthlyPnlRows(trades);

    expect(monthly).toHaveLength(1);
    expect(monthly[0].month).toBe("2026-02");
    expect(monthly[0].trade_count).toBe("1");
    expect(Number(monthly[0].net_pnl_full)).toBeLessThan(Number(monthly[0].gross_pnl));
  });
});
