import { SECURITY_PATTERN } from "./constants";
import type { ParsedSecurity } from "./models";
import { cleanSecurity, normalizeCell, parseContractExpiry, toDecimal } from "./utils";

export function parseSecurity(value: string): ParsedSecurity {
  const cleaned = cleanSecurity(value);
  const match = SECURITY_PATTERN.exec(cleaned);

  if (!match?.groups) {
    throw new Error(`Unsupported security format: ${cleaned}`);
  }

  const family = match.groups.family;
  const instrumentKind = family.startsWith("OPT") ? "OPTION" : "FUTURE";

  return {
    raw: cleaned,
    symbol: match.groups.symbol,
    family,
    instrumentKind,
    marketKind: family.slice(-3),
    expiry: parseContractExpiry(match.groups.expiry),
    optionType: (match.groups.optionType as "CE" | "PE" | undefined) ?? null,
    strike: match.groups.strike ? toDecimal(match.groups.strike) : null,
  };
}

export function parseEquitySecurity(isin: string, securityName: string): ParsedSecurity {
  const normalizedIsin = normalizeCell(isin);
  const normalizedName = normalizeCell(securityName);

  return {
    raw: `${normalizedIsin}|${normalizedName}`,
    symbol: normalizedName,
    family: "EQ",
    instrumentKind: "EQUITY",
    marketKind: "EQ",
    expiry: null,
    optionType: null,
    strike: null,
    isin: normalizedIsin || null,
    securityName: normalizedName || null,
    matchKey: normalizedIsin || normalizedName.toUpperCase(),
  };
}

export function displayInstrument(security: ParsedSecurity): string {
  if (security.instrumentKind === "EQUITY") {
    return "EQ";
  }

  if (security.instrumentKind === "OPTION" && security.expiry && security.optionType && security.strike) {
    const [year, month, day] = security.expiry.split("-");
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const monthText = monthNames[Number(month) - 1] ?? month;
    return `${security.optionType} ${security.strike.toDecimalPlaces(2).toFixed(2)} ${day}${monthText}${year}`;
  }

  if (security.expiry) {
    const [year, month, day] = security.expiry.split("-");
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const monthText = monthNames[Number(month) - 1] ?? month;
    return `FUT ${day}${monthText}${year}`;
  }

  return security.family;
}
