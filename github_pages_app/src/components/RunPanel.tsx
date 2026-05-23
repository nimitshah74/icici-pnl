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
        <p>Current slice: upload intake, content-based type detection, and frontend contract wiring.</p>
      </div>
      <button
        type="button"
        className="primary-button"
        disabled={!canGenerate}
        onClick={() => void onGenerate()}
      >
        {isGenerating ? "Preparing..." : "Generate Report"}
      </button>
    </section>
  );
}
