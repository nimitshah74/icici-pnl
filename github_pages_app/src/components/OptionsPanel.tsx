import type { WorkbookDownloadOptions } from "../domain/models";

interface OptionsPanelProps {
  options: WorkbookDownloadOptions;
  onOptionChange: <K extends keyof WorkbookDownloadOptions>(
    key: K,
    value: WorkbookDownloadOptions[K],
  ) => void;
}

export function OptionsPanel({ options, onOptionChange }: OptionsPanelProps) {
  return (
    <article className="card">
      <div className="card__header">
        <div>
          <h2>2. Extraction Options</h2>
          <p>These controls already mirror the frozen MVP output contract.</p>
        </div>
      </div>

      <div className="option-list">
        <label className="option">
          <input
            type="checkbox"
            checked={options.includeExcel}
            onChange={(event) => onOptionChange("includeExcel", event.target.checked)}
          />
          <div>
            <strong>Generate Excel workbook</strong>
            <span>Master `.xlsx` output matching the current desktop workbook structure.</span>
          </div>
        </label>
        <label className="option">
          <input
            type="checkbox"
            checked={options.includeCsv}
            onChange={(event) => onOptionChange("includeCsv", event.target.checked)}
          />
          <div>
            <strong>Include CSV exports</strong>
            <span>Raw rows, closed trades, open positions, and monthly P&amp;L files.</span>
          </div>
        </label>
        <label className="option">
          <input
            type="checkbox"
            checked={options.includeMeta}
            onChange={(event) => onOptionChange("includeMeta", event.target.checked)}
          />
          <div>
            <strong>Include markdown / JSON reports</strong>
            <span>
              Audit-oriented outputs such as `report.md`, `reconciliation.json`, and
              source manifest files.
            </span>
          </div>
        </label>
      </div>

      <div className="radio-grid">
        <label
          className={`radio-card ${
            options.downloadMode === "excel" ? "radio-card--active" : ""
          }`}
        >
          <input
            type="radio"
            name="download-mode"
            checked={options.downloadMode === "excel"}
            onChange={() => onOptionChange("downloadMode", "excel")}
          />
          <div>
            <strong>Download Excel only</strong>
            <span>Fastest path for the common use case.</span>
          </div>
        </label>
        <label
          className={`radio-card ${
            options.downloadMode === "zip" ? "radio-card--active" : ""
          }`}
        >
          <input
            type="radio"
            name="download-mode"
            checked={options.downloadMode === "zip"}
            onChange={() => onOptionChange("downloadMode", "zip")}
          />
          <div>
            <strong>Download full bundle</strong>
            <span>Excel plus CSV and metadata exports inside a zip archive.</span>
          </div>
        </label>
      </div>
    </article>
  );
}
