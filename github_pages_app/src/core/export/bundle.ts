import JSZip from "jszip";

import type { WorkbookDownloadOptions } from "../../domain/models";
import type { WorkbookDataPayload } from "../reporting";
import { buildMarkdownReport, settlementTemplateRows } from "../reporting";
import type { ProcessedWorkbookData } from "../models";
import { recordsToCsv } from "./csv";
import { buildWorkbookBlob } from "./workbook";

export async function buildDownloadBundle(
  processed: ProcessedWorkbookData,
  payload: WorkbookDataPayload,
  options: WorkbookDownloadOptions,
) {
  const workbookBlob = options.includeExcel ? await buildWorkbookBlob(payload) : null;

  if (options.downloadMode === "excel") {
    if (!workbookBlob) {
      throw new Error("Excel export is disabled in the current options.");
    }

    return {
      filename: "icici_trade_pnl.xlsx",
      blob: workbookBlob,
    };
  }

  const zip = new JSZip();
  if (workbookBlob) {
    zip.file("icici_trade_pnl.xlsx", workbookBlob);
  }

  if (options.includeCsv) {
    zip.file("closed_trades.csv", recordsToCsv(payload.closed_trades));
    zip.file("open_positions.csv", recordsToCsv(payload.open_positions));
    zip.file("parsed_rows.csv", recordsToCsv(payload.parsed_rows));
    zip.file("monthly_pnl.csv", recordsToCsv(payload.monthly_pnl));
    zip.file(
      "expiry_settlement_template.csv",
      recordsToCsv(settlementTemplateRows(processed.openPositions, processed.statementPeriod.end)),
    );
  }

  if (options.includeMeta) {
    zip.file("reconciliation.json", JSON.stringify(payload.reconciliation, null, 2));
    zip.file("source_manifest.json", JSON.stringify(payload.source_manifest, null, 2));
    zip.file(
      "report.md",
      buildMarkdownReport(payload.reconciliation, processed.trades, processed.openPositions),
    );
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return {
    filename: "icici_trade_pnl_bundle.zip",
    blob,
  };
}
