import type { ResultMetrics } from "../domain/models";
import { formatCurrency } from "../utils/formatters";

interface ResultsPanelProps {
  results: ResultMetrics;
  hasDownloads: boolean;
  onDownloadExcel: () => Promise<void>;
  onDownloadBundle: () => Promise<void>;
}

export function ResultsPanel({
  results,
  hasDownloads,
  onDownloadExcel,
  onDownloadBundle,
}: ResultsPanelProps) {
  return (
    <>
      <section className="results-grid">
        <article className="metric-card">
          <span>Execution Rows</span>
          <strong>{results.executionRows}</strong>
        </article>
        <article className="metric-card">
          <span>Closed Trades</span>
          <strong>{results.closedTrades}</strong>
        </article>
        <article className="metric-card">
          <span>Unresolved Positions</span>
          <strong>{results.unresolvedPositions}</strong>
        </article>
        <article className="metric-card">
          <span>Gross P&amp;L</span>
          <strong>{formatCurrency(results.grossPnl)}</strong>
        </article>
        <article className="metric-card">
          <span>Net P&amp;L</span>
          <strong>{formatCurrency(results.netPnl)}</strong>
        </article>
      </section>

      <section className="download-card">
        <div>
          <h2>Results</h2>
          <p>Download the Excel workbook directly, or export the full audit bundle with CSV and metadata files.</p>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            disabled={!hasDownloads}
            onClick={() => void onDownloadExcel()}
          >
            Download Excel
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!hasDownloads}
            onClick={() => void onDownloadBundle()}
          >
            Download Full Bundle
          </button>
        </div>
      </section>
    </>
  );
}
