import { Decimal, money, precise, toDecimal, ZERO } from "./decimal";

export function normalizeCell(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function cleanSecurity(value: string): string {
  return normalizeCell(value).replace(/@/g, "").replace(/\s+/g, "");
}

export function parseStatementDate(value: string): string {
  const cleaned = normalizeCell(value);
  const [day, mon, year] = cleaned.split("-");
  const monthIndex = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ].indexOf(mon.toUpperCase());

  if (monthIndex === -1) {
    throw new Error(`Unsupported statement date: ${cleaned}`);
  }

  const month = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseContractExpiry(value: string): string {
  const cleaned = normalizeCell(value);
  const day = cleaned.slice(0, 2);
  const mon = cleaned.slice(2, 5);
  const year = cleaned.slice(5);
  return parseStatementDate(`${day}-${mon}-${year}`);
}

export function parsePdfDateTime(value: string): string {
  const cleaned = normalizeCell(value);
  const match = cleaned.match(/^(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)$/);

  if (!match) {
    throw new Error(`Unsupported PDF datetime: ${cleaned}`);
  }

  const [, datePart, timePart] = match;
  const [day, month, year] = datePart.split("-");
  const seconds = timePart.length === 5 ? `${timePart}:00` : timePart;
  return `${year}-${month}-${day} ${seconds}`;
}

export function buildExecutionSignature(lines: string[]): string {
  const payload = lines.join("\n");
  let hash = 5381;

  for (let index = 0; index < payload.length; index += 1) {
    hash = (hash * 33) ^ payload.charCodeAt(index);
  }

  return `sig_${(hash >>> 0).toString(16)}`;
}

export function maxDecimal(values: Decimal[]): Decimal {
  return values.reduce((currentMax, value) => (value.greaterThan(currentMax) ? value : currentMax), ZERO);
}

export function minDate(values: string[]): string {
  return [...values].sort()[0];
}

export function maxDate(values: string[]): string {
  return [...values].sort().slice(-1)[0];
}

export function sumDecimals(values: Decimal[]): Decimal {
  return values.reduce((sum, value) => sum.add(value), ZERO);
}

export function deriveStableRowIdentity(parts: Array<string | number | Decimal>): string {
  return parts
    .map((part) => {
      if (part instanceof Decimal) {
        return precise(part);
      }

      return String(part);
    })
    .join("|");
}

export function decimalToNumber(value: Decimal | null | undefined): number {
  if (!value) {
    return 0;
  }

  return Number(money(value));
}

export function parseNumberish(value: string): number {
  return Number(normalizeCell(value));
}

export function sanitizeFileStem(value: string): string {
  return value.replace(/\.pdf$/i, "").replace(/[^a-z0-9._-]+/gi, "_");
}

export function sortIsoDateTimes(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function boolString(value: boolean): string {
  return value ? "true" : "false";
}

export { money, precise, toDecimal };
