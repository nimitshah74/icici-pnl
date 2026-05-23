export function AppHeader() {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <div className="brand-mark">P&amp;L</div>
        <div>
          <h1>ICICI Trade P&amp;L</h1>
          <p>
            Upload ICICIdirect transaction PDFs and generate a reconciled P&amp;L
            workbook locally in your browser.
          </p>
        </div>
      </div>
      <div className="privacy-pill">
        <strong>100% client-side</strong>
        <span>Files never leave your device.</span>
      </div>
    </header>
  );
}
