import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { LINE_Y_TOLERANCE } from "../constants";
import type { PdfDocumentLayout, PdfLayoutItem, PdfLayoutLine, PdfPageLayout } from "../models";
import { normalizeCell } from "../utils";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfJsTextItem {
  str: string;
  transform: number[];
  width: number;
}

function isPdfJsTextItem(value: unknown): value is PdfJsTextItem {
  return typeof value === "object" && value !== null && "str" in value && "transform" in value && "width" in value;
}

function buildLineText(items: PdfLayoutItem[]): string {
  return normalizeCell(items.map((item) => item.text).join(" "));
}

function groupItemsIntoLines(items: PdfLayoutItem[]): PdfLayoutLine[] {
  const lines: Array<{ y: number; items: PdfLayoutItem[] }> = [];

  for (const item of items) {
    const existingLine = lines.find((line) => Math.abs(line.y - item.y) <= LINE_Y_TOLERANCE);

    if (existingLine) {
      existingLine.items.push(item);
      continue;
    }

    lines.push({ y: item.y, items: [item] });
  }

  return lines
    .map((line) => {
      const sortedItems = [...line.items].sort((left, right) => left.x - right.x);
      return {
        y: line.y,
        items: sortedItems,
        text: buildLineText(sortedItems),
      };
    })
    .sort((left, right) => right.y - left.y);
}

async function extractPageLayout(
  documentProxy: Awaited<ReturnType<typeof getDocument>>["promise"] extends Promise<infer T>
    ? T
    : never,
  pageNumber: number,
): Promise<PdfPageLayout> {
  const page = await documentProxy.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const rawItems = (textContent.items as unknown[]).filter(isPdfJsTextItem);

  const items: PdfLayoutItem[] = rawItems
    .map((item) => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
    }))
    .filter((item) => normalizeCell(item.text).length > 0);

  const lines = groupItemsIntoLines(items);

  return {
    pageNumber,
    lines,
    text: normalizeCell(lines.map((line) => line.text).join("\n")),
  };
}

export async function extractPdfDocumentLayout(file: File): Promise<PdfDocumentLayout> {
  const data = await file.arrayBuffer();
  const documentProxy = await getDocument({ data }).promise;
  const pages: PdfPageLayout[] = [];

  for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
    pages.push(await extractPageLayout(documentProxy, pageNumber));
  }

  const firstPageText = pages[0]?.lines.map((line) => line.text).join("\n") ?? "";
  const scannedText = pages.map((page) => page.lines.map((line) => line.text).join("\n")).join("\n");

  return {
    pageCount: documentProxy.numPages,
    firstPageText,
    scannedText,
    pages,
  };
}
