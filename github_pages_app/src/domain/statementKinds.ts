import type { DisplayStatementKind, StatementKind } from "./models";

export function toDisplayStatementKind(kind: StatementKind): DisplayStatementKind {
  if (kind === "MCX") {
    return "COMMODITY";
  }

  return kind;
}
