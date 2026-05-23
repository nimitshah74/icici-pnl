import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { PdfTextSnapshot } from "../../domain/models";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const DEFAULT_PAGE_SAMPLE_COUNT = 2;

function normalizeExtractedText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function extractPageText(
  documentProxy: Awaited<ReturnType<typeof getDocument>>["promise"] extends Promise<infer T>
    ? T
    : never,
  pageNumber: number,
): Promise<string> {
  const page = await documentProxy.getPage(pageNumber);
  const textContent = await page.getTextContent();

  return normalizeExtractedText(
    textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" "),
  );
}

export async function extractPdfTextSnapshot(file: File): Promise<PdfTextSnapshot> {
  const data = await file.arrayBuffer();
  const documentProxy = await getDocument({ data }).promise;
  const sampledPages = Math.min(DEFAULT_PAGE_SAMPLE_COUNT, documentProxy.numPages);
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= sampledPages; pageNumber += 1) {
    pageTexts.push(await extractPageText(documentProxy, pageNumber));
  }

  return {
    pageCount: documentProxy.numPages,
    firstPageText: pageTexts[0] ?? "",
    scannedText: normalizeExtractedText(pageTexts.join(" ")),
    sampledPages,
  };
}
