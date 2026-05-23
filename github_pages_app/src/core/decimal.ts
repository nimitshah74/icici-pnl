import Decimal from "decimal.js";

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export { Decimal };

export const ZERO = new Decimal(0);

export function toDecimal(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) {
    return value;
  }

  if (typeof value === "number") {
    return new Decimal(value);
  }

  return new Decimal(value.replace(/,/g, "").trim());
}

export function money(value: Decimal): string {
  return value.toDecimalPlaces(2).toFixed(2);
}

export function precise(value: Decimal): string {
  return value.toDecimalPlaces(6).toFixed(6);
}

export function prorate(amount: Decimal, numerator: number, denominator: number): Decimal {
  if (denominator === 0) {
    return ZERO;
  }

  return amount.mul(numerator).div(denominator);
}
