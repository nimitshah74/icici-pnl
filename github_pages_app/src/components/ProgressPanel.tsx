interface ProgressPanelProps {
  statusText: string;
  progressPercent: number;
}

export function ProgressPanel({
  statusText,
  progressPercent,
}: ProgressPanelProps) {
  return (
    <section className="progress-card">
      <div className="progress-card__row">
        <span>{statusText}</span>
        <strong>{progressPercent}%</strong>
      </div>
      <div className="progress-bar">
        <div className="progress-bar__fill" style={{ width: `${progressPercent}%` }} />
      </div>
    </section>
  );
}
