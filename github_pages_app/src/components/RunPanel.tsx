interface RunPanelProps {
  canGenerate: boolean;
  isGenerating: boolean;
  onGenerate: () => Promise<void>;
}

export function RunPanel({ canGenerate, isGenerating, onGenerate }: RunPanelProps) {
  return (
    <section className="run-card">
      <div>
        <h2>3. Processor Command Center</h2>
        <p>Run the browser-side parser, reconstruct trades, and prepare downloadable report artifacts locally.</p>
      </div>
      <button
        type="button"
        className="primary-button"
        disabled={!canGenerate}
        onClick={() => void onGenerate()}
      >
        {isGenerating ? "Generating..." : "Generate Report"}
      </button>
    </section>
  );
}
