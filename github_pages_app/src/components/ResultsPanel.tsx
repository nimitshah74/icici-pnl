import type { ResultMetrics } from "../domain/models";
import { formatCurrency } from "../utils/formatters";

interface ResultsPanelProps {
  results: ResultMetrics;
}

export function ResultsPanel({ results }: ResultsPanelProps) {
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
          <p>Download actions will be enabled when the browser parser and export pipeline lands in the next slices.</p>
        </div>
        <div className="button-row">
          <button type="button" className="secondary-button" disabled>
            Download Excel
          </button>
          <button type="button" className="secondary-button" disabled>
            Download Full Bundle
          </button>
        </div>
      </section>
    </>
  );
}
