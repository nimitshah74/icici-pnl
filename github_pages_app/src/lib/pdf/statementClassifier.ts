import type { PdfDetectionResult, PdfTextSnapshot, StatementKind } from "../../domain/models";
import { toDisplayStatementKind } from "../../domain/statementKinds";

const STATEMENT_PERIOD_PATTERN =
  /\bfrom\s+\d{1,2}-[A-Za-z]{3}-\d{4}\s+to\s+\d{1,2}-[A-Za-z]{3}-\d{4}\b/i;

const TITLE_PATTERNS: Array<{
  pattern: RegExp;
  kind: StatementKind;
  confidence: PdfDetectionResult["confidence"];
}> = [
  {
    pattern: /commodity\s+derivatives\s+transaction\s+statement/i,
    kind: "MCX",
    confidence: "high",
  },
  {
    pattern: /equity\s+transaction\s+statement/i,
    kind: "EQUITY",
    confidence: "high",
  },
  {
    pattern: /derivatives\s+transaction\s+statement/i,
    kind: "FNO",
    confidence: "high",
  },
];

const HEADER_PATTERNS: Array<{
  pattern: RegExp;
  kind: StatementKind;
  note: string;
}> = [
  {
    pattern: /\bisin\b[\s\S]{0,200}\bsecurity\b/i,
    kind: "EQUITY",
    note: "Detected equity-style headers with ISIN and Security fields.",
  },
  {
    pattern: /\bsettlement\s+no\b[\s\S]{0,200}\bsecurity\b/i,
    kind: "EQUITY",
    note: "Detected settlement number and security columns, typical of equity reports.",
  },
  {
    pattern: /\boption\s+type\b|\bstrike\b|\bexpiry\b/i,
    kind: "FNO",
    note: "Detected derivatives-style contract columns such as expiry, strike, or option type.",
  },
];

const CONTENT_PATTERNS: Array<{
  pattern: RegExp;
  kind: StatementKind;
  note: string;
}> = [
  {
    pattern: /optstk|optidx|futstk|futidx/i,
    kind: "FNO",
    note: "Detected listed derivatives contract tokens in the extracted rows.",
  },
  {
    pattern: /mcx|crudeoil|naturalgas|goldm|silverm|zinc|copper|aluminium/i,
    kind: "MCX",
    note: "Detected commodity exchange or commodity contract keywords.",
  },
  {
    pattern: /\bIN[A-Z0-9]{10}\b/i,
    kind: "EQUITY",
    note: "Detected ISIN-like identifiers in the extracted content.",
  },
];

const UNKNOWN_RESULT: PdfDetectionResult = {
  statementKind: "UNKNOWN",
  displayKind: "UNKNOWN",
  confidence: "low",
  supported: false,
  titleText: "",
  evidence: {
    method: "none",
    notes: ["No supported ICICIdirect statement signature was detected."],
  },
};

function extractStatementPeriod(text: string): string | undefined {
  return text.match(STATEMENT_PERIOD_PATTERN)?.[0];
}

// Title-based matching stays first because ICICIdirect statement titles are the most stable signal.
export function classifyStatementSnapshot(
  snapshot: PdfTextSnapshot,
): PdfDetectionResult {
  for (const entry of TITLE_PATTERNS) {
    if (entry.pattern.test(snapshot.firstPageText)) {
      const matchedText = snapshot.firstPageText.match(entry.pattern)?.[0] ?? "";

      return {
        statementKind: entry.kind,
        displayKind: toDisplayStatementKind(entry.kind),
        confidence: entry.confidence,
        supported: true,
        titleText: snapshot.firstPageText,
        statementPeriodText: extractStatementPeriod(snapshot.firstPageText),
        evidence: {
          method: "title",
          matchedText,
          notes: [
            "Detected statement kind from the first-page title text.",
            `Read ${snapshot.sampledPages} page(s) for classification.`,
          ],
        },
      };
    }
  }

  for (const entry of HEADER_PATTERNS) {
    if (entry.pattern.test(snapshot.scannedText)) {
      return {
        statementKind: entry.kind,
        displayKind: toDisplayStatementKind(entry.kind),
        confidence: "medium",
        supported: true,
        titleText: snapshot.firstPageText,
        statementPeriodText: extractStatementPeriod(snapshot.scannedText),
        evidence: {
          method: "header",
          matchedText: snapshot.scannedText.match(entry.pattern)?.[0] ?? "",
          notes: [entry.note],
        },
      };
    }
  }

  for (const entry of CONTENT_PATTERNS) {
    if (entry.pattern.test(snapshot.scannedText)) {
      return {
        statementKind: entry.kind,
        displayKind: toDisplayStatementKind(entry.kind),
        confidence: "low",
        supported: true,
        titleText: snapshot.firstPageText,
        statementPeriodText: extractStatementPeriod(snapshot.scannedText),
        evidence: {
          method: "content",
          matchedText: snapshot.scannedText.match(entry.pattern)?.[0] ?? "",
          notes: [entry.note],
        },
      };
    }
  }

  return {
    ...UNKNOWN_RESULT,
    titleText: snapshot.firstPageText,
    statementPeriodText: extractStatementPeriod(snapshot.scannedText),
  };
}
