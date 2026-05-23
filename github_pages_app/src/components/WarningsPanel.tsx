import type { WarningItem } from "../domain/models";

interface WarningsPanelProps {
  warnings: WarningItem[];
}

export function WarningsPanel({ warnings }: WarningsPanelProps) {
  return (
    <section className="warnings-card">
      <div className="card__header">
        <div>
          <h2>Warnings &amp; Diagnostics</h2>
          <p>Unsupported files and MVP implementation notes appear here.</p>
        </div>
        <span className="badge-warn">{warnings.length}</span>
      </div>
      <div className="warning-list">
        {warnings.length === 0 ? (
          <div className="empty-state">No warnings yet.</div>
        ) : (
          warnings.map((warning) => (
            <div key={warning.id} className={`warning warning--${warning.level}`}>
              <strong>{warning.title}</strong>
              <p>{warning.message}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
