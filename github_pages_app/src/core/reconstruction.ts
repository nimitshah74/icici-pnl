import { Decimal, ZERO } from "./decimal";
import type { ExecutionRow, OpenLot, OpenPosition, ReconstructedTrade, SummaryTotals } from "./models";
import { settlementCloseTimeIso } from "./parsing/statementParser";
import { securityKey } from "./derived";
import { prorate } from "./decimal";

function allocRowAmounts(row: ExecutionRow, quantity: number) {
  return {
    totalValue: prorate(row.totalValue, quantity, row.quantity),
    brokerage: prorate(row.brokerage, quantity, row.quantity),
    gst: prorate(row.gst, quantity, row.quantity),
    stt: prorate(row.rowStt, quantity, row.quantity),
  };
}

function buildTrade(
  matchId: number,
  openRow: ExecutionRow,
  closeRow: ExecutionRow | null,
  quantity: number,
  closeReason: "TRADE" | "SETTLEMENT",
  settlementRate = ZERO,
): ReconstructedTrade {
  const openAlloc = allocRowAmounts(openRow, quantity);
  const position = openRow.side === "B" ? "LONG" : "SHORT";
  let closeSide: "B" | "S";
  let closeRate;
  let closeTradeNo: string | null;
  let closeTime: string | null;
  let closeTotalValue;
  let allocatedBrokerage;
  let allocatedGst;
  let allocatedStt;

  if (closeRow) {
    const closeAlloc = allocRowAmounts(closeRow, quantity);
    closeSide = closeRow.side;
    closeRate = closeRow.grossRate;
    closeTradeNo = closeRow.tradeNo;
    closeTime = closeRow.tradeTime;
    closeTotalValue = closeAlloc.totalValue;
    allocatedBrokerage = openAlloc.brokerage.add(closeAlloc.brokerage);
    allocatedGst = openAlloc.gst.add(closeAlloc.gst);
    allocatedStt = openAlloc.stt.add(closeAlloc.stt);
  } else {
    if (!openRow.security.expiry) {
      throw new Error("Security expiry is required for settlement closes.");
    }

    closeSide = openRow.side === "B" ? "S" : "B";
    closeRate = settlementRate;
    closeTradeNo = null;
    closeTime = settlementCloseTimeIso(openRow.security.expiry);
    closeTotalValue = ZERO;
    allocatedBrokerage = openAlloc.brokerage;
    allocatedGst = openAlloc.gst;
    allocatedStt = openAlloc.stt;
  }

  const grossPnl =
    position === "LONG"
      ? closeRate.sub(openRow.grossRate).mul(quantity)
      : openRow.grossRate.sub(closeRate).mul(quantity);

  let tradeStyle: ReconstructedTrade["tradeStyle"] = "";
  if (openRow.statementKind === "EQUITY" && closeRow) {
    tradeStyle = openRow.tradeTime.slice(0, 10) === closeRow.tradeTime.slice(0, 10) ? "INTRADAY" : "DELIVERY";
  } else if (openRow.statementKind === "FNO" || openRow.statementKind === "MCX") {
    tradeStyle =
      closeRow && openRow.tradeTime.slice(0, 10) === closeRow.tradeTime.slice(0, 10)
        ? "INTRADAY"
        : "POSITIONAL";
  }

  return {
    matchId,
    statementKind: openRow.statementKind,
    security: openRow.security,
    position,
    openSide: openRow.side,
    closeSide,
    quantity,
    openTime: openRow.tradeTime,
    closeTime,
    openTradeNo: openRow.tradeNo,
    closeTradeNo,
    openRate: openRow.grossRate,
    closeRate,
    grossPnl,
    openTotalValue: openAlloc.totalValue,
    closeTotalValue,
    buyTotalValue: openRow.side === "B" ? openAlloc.totalValue : closeTotalValue,
    sellTotalValue: openRow.side === "S" ? openAlloc.totalValue : closeTotalValue,
    allocatedBrokerage,
    allocatedGst,
    allocatedStt,
    allocatedSummaryOnlyStt: ZERO,
    allocatedTransactionCharges: ZERO,
    allocatedStampDuty: ZERO,
    allocatedSebiFees: ZERO,
    closeReason,
    tradeStyle,
  };
}

function reconstructDerivativeTrades(
  rows: ExecutionRow[],
  settlementRates: Record<string, Decimal>,
) {
  const openLots = new Map<string, OpenLot[]>();
  const trades: ReconstructedTrade[] = [];

  for (const row of rows) {
    const key = securityKey(row.security);
    const book = openLots.get(key) ?? [];
    const opposingSide = row.side === "B" ? "S" : "B";
    let remaining = row.quantity;

    while (remaining > 0 && book.length > 0 && book[0].row.side === opposingSide) {
      const lot = book[0];
      const matchedQty = Math.min(remaining, lot.remainingQty);
      trades.push(buildTrade(0, lot.row, row, matchedQty, "TRADE"));
      remaining -= matchedQty;
      lot.remainingQty -= matchedQty;
      if (lot.remainingQty === 0) {
        book.shift();
      }
    }

    if (remaining > 0) {
      book.push({ row, remainingQty: remaining });
    }

    openLots.set(key, book);
  }

  const openPositions: OpenPosition[] = [];
  for (const [key, book] of openLots.entries()) {
    const settlementRate = settlementRates[key];
    for (const lot of book) {
      if (settlementRate) {
        trades.push(buildTrade(0, lot.row, null, lot.remainingQty, "SETTLEMENT", settlementRate));
        continue;
      }

      openPositions.push({
        statementKind: lot.row.statementKind,
        security: lot.row.security,
        side: lot.row.side,
        quantity: lot.remainingQty,
        openTime: lot.row.tradeTime,
        tradeNo: lot.row.tradeNo,
        openRate: lot.row.grossRate,
        totalValue: prorate(lot.row.totalValue, lot.remainingQty, lot.row.quantity),
        brokerage: prorate(lot.row.brokerage, lot.remainingQty, lot.row.quantity),
        gst: prorate(lot.row.gst, lot.remainingQty, lot.row.quantity),
        stt: prorate(lot.row.rowStt, lot.remainingQty, lot.row.quantity),
        positionNote: "",
      });
    }
  }

  return { trades, openPositions };
}

function reconstructEquityTrades(rows: ExecutionRow[]) {
  const longLots = new Map<string, OpenLot[]>();
  const intradayShortLots = new Map<string, OpenLot[]>();
  const trades: ReconstructedTrade[] = [];

  for (const row of rows) {
    const key = securityKey(row.security);
    let remaining = row.quantity;

    if (row.side === "S") {
      const longBook = longLots.get(key) ?? [];
      while (remaining > 0 && longBook.length > 0) {
        const lot = longBook[0];
        const matchedQty = Math.min(remaining, lot.remainingQty);
        trades.push(buildTrade(0, lot.row, row, matchedQty, "TRADE"));
        remaining -= matchedQty;
        lot.remainingQty -= matchedQty;
        if (lot.remainingQty === 0) {
          longBook.shift();
        }
      }

      if (remaining > 0) {
        const shortKey = `${key}::${row.tradeTime.slice(0, 10)}`;
        const shortBook = intradayShortLots.get(shortKey) ?? [];
        shortBook.push({ row, remainingQty: remaining });
        intradayShortLots.set(shortKey, shortBook);
      }

      longLots.set(key, longBook);
      continue;
    }

    const shortKey = `${key}::${row.tradeTime.slice(0, 10)}`;
    const shortBook = intradayShortLots.get(shortKey) ?? [];
    while (remaining > 0 && shortBook.length > 0) {
      const lot = shortBook[0];
      const matchedQty = Math.min(remaining, lot.remainingQty);
      trades.push(buildTrade(0, lot.row, row, matchedQty, "TRADE"));
      remaining -= matchedQty;
      lot.remainingQty -= matchedQty;
      if (lot.remainingQty === 0) {
        shortBook.shift();
      }
    }

    intradayShortLots.set(shortKey, shortBook);
    if (remaining > 0) {
      const longBook = longLots.get(key) ?? [];
      longBook.push({ row, remainingQty: remaining });
      longLots.set(key, longBook);
    }
  }

  const openPositions: OpenPosition[] = [];
  for (const book of longLots.values()) {
    for (const lot of book) {
      openPositions.push({
        statementKind: "EQUITY",
        security: lot.row.security,
        side: lot.row.side,
        quantity: lot.remainingQty,
        openTime: lot.row.tradeTime,
        tradeNo: lot.row.tradeNo,
        openRate: lot.row.grossRate,
        totalValue: prorate(lot.row.totalValue, lot.remainingQty, lot.row.quantity),
        brokerage: prorate(lot.row.brokerage, lot.remainingQty, lot.row.quantity),
        gst: prorate(lot.row.gst, lot.remainingQty, lot.row.quantity),
        stt: prorate(lot.row.rowStt, lot.remainingQty, lot.row.quantity),
        positionNote: "Open equity buy carried beyond the statement close.",
      });
    }
  }

  for (const book of intradayShortLots.values()) {
    for (const lot of book) {
      openPositions.push({
        statementKind: "EQUITY",
        security: lot.row.security,
        side: lot.row.side,
        quantity: lot.remainingQty,
        openTime: lot.row.tradeTime,
        tradeNo: lot.row.tradeNo,
        openRate: lot.row.grossRate,
        totalValue: prorate(lot.row.totalValue, lot.remainingQty, lot.row.quantity),
        brokerage: prorate(lot.row.brokerage, lot.remainingQty, lot.row.quantity),
        gst: prorate(lot.row.gst, lot.remainingQty, lot.row.quantity),
        stt: prorate(lot.row.rowStt, lot.remainingQty, lot.row.quantity),
        positionNote:
          "Unmatched equity sell. This usually means the shares were carried into the statement period from earlier holdings, so statement-only P&L cannot be reconstructed.",
      });
    }
  }

  return { trades, openPositions };
}

export function reconstructTrades(
  rows: ExecutionRow[],
  settlementRates: Record<string, Decimal> = {},
) {
  const sortedRows = [...rows].sort(
    (left, right) =>
      left.tradeTime.localeCompare(right.tradeTime) ||
      left.orderNo.localeCompare(right.orderNo) ||
      left.tradeNo.localeCompare(right.tradeNo) ||
      left.sequence - right.sequence,
  );

  const derivativeRows = sortedRows.filter((row) => row.statementKind !== "EQUITY");
  const equityRows = sortedRows.filter((row) => row.statementKind === "EQUITY");

  const derivative = reconstructDerivativeTrades(derivativeRows, settlementRates);
  const equity = reconstructEquityTrades(equityRows);
  const trades = [...derivative.trades, ...equity.trades].sort(
    (left, right) =>
      left.openTime.localeCompare(right.openTime) ||
      (left.closeTime ?? left.openTime).localeCompare(right.closeTime ?? right.openTime) ||
      left.security.raw.localeCompare(right.security.raw),
  );

  trades.forEach((trade, index) => {
    trade.matchId = index + 1;
  });

  const openPositions = [...derivative.openPositions, ...equity.openPositions].sort(
    (left, right) =>
      left.security.raw.localeCompare(right.security.raw) ||
      left.openTime.localeCompare(right.openTime) ||
      left.tradeNo.localeCompare(right.tradeNo),
  );

  return { trades, openPositions };
}

export function allocateSummaryCosts(trades: ReconstructedTrade[], summary: SummaryTotals) {
  const totalTurnover = trades.reduce(
    (sum, trade) => sum.add(trade.buyTotalValue).add(trade.sellTotalValue),
    ZERO,
  );
  const totalBuyTurnover = trades.reduce((sum, trade) => sum.add(trade.buyTotalValue), ZERO);
  const summaryOnlyStt = Decimal.max(
    summary.stt.sub(trades.reduce((sum, trade) => sum.add(trade.allocatedStt), ZERO)),
    ZERO,
  );

  for (const trade of trades) {
    const turnover = trade.buyTotalValue.add(trade.sellTotalValue);
    trade.allocatedSummaryOnlyStt = totalTurnover.eq(0)
      ? ZERO
      : summaryOnlyStt.mul(turnover).div(totalTurnover);
    trade.allocatedTransactionCharges = totalTurnover.eq(0)
      ? ZERO
      : summary.transactionCharges.mul(turnover).div(totalTurnover);
    trade.allocatedSebiFees = totalTurnover.eq(0)
      ? ZERO
      : summary.sebiFees.mul(turnover).div(totalTurnover);
    trade.allocatedStampDuty = totalBuyTurnover.eq(0)
      ? ZERO
      : summary.stampDuty.mul(trade.buyTotalValue).div(totalBuyTurnover);
  }
}
