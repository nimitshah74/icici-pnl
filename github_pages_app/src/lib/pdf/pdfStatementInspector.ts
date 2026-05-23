import type { PdfDetectionResult } from "../../domain/models";
import { extractPdfTextSnapshot } from "./pdfTextExtractor";
import { classifyStatementSnapshot } from "./statementClassifier";

export async function inspectPdfStatement(file: File): Promise<PdfDetectionResult> {
  const snapshot = await extractPdfTextSnapshot(file);
  return classifyStatementSnapshot(snapshot);
}
