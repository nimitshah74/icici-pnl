import type { ExecutionRow, OpenPosition, ParsedSecurity, ReconstructedTrade } from "./models";
import { ZERO } from "./decimal";

export function securityKey(security: ParsedSecurity): string {
  return security.matchKey ?? security.raw;
}

export function executionRowTurnover(row: ExecutionRow) {
  return row.totalValue;
}

export function executionRowRowCost(row: ExecutionRow) {
  return row.brokerage.add(row.gst).add(row.rowStt);
}

export function executionRowSignedNetCashflow(row: ExecutionRow) {
  return row.side === "S" ? row.netAmount : row.netAmount.neg();
}

export function tradeAllocatedRowCosts(trade: ReconstructedTrade) {
  return trade.allocatedBrokerage.add(trade.allocatedGst).add(trade.allocatedStt);
}

export function tradeNetPnlRowCosts(trade: ReconstructedTrade) {
  return trade.grossPnl.sub(tradeAllocatedRowCosts(trade));
}

export function tradeNetPnlFull(trade: ReconstructedTrade) {
  return tradeNetPnlRowCosts(trade)
    .sub(trade.allocatedSummaryOnlyStt)
    .sub(trade.allocatedTransactionCharges)
    .sub(trade.allocatedStampDuty)
    .sub(trade.allocatedSebiFees);
}

export function tradeStatus(trade: ReconstructedTrade): "CLOSED" | "RESOLVED" {
  return trade.closeReason === "TRADE" ? "CLOSED" : "RESOLVED";
}

export function openPositionRowCost(position: OpenPosition) {
  return position.brokerage.add(position.gst).add(position.stt);
}

export function decimalSum<T>(items: T[], selector: (item: T) => ReturnType<typeof ZERO.add>) {
  return items.reduce((sum, item) => sum.add(selector(item)), ZERO);
}
