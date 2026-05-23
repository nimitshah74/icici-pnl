import { useRef, useState } from "react";

import type { UploadedPdf } from "../domain/models";
import { formatBytes } from "../utils/formatters";

interface UploadPanelProps {
  files: UploadedPdf[];
  onAnalyzeFiles: (files: FileList | File[]) => Promise<void>;
  onRemoveFile: (id: string) => void;
}

export function UploadPanel({
  files,
  onAnalyzeFiles,
  onRemoveFile,
}: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <article className="card">
      <div className="card__header">
        <div>
          <h2>1. Upload Statements</h2>
          <p>Drag PDFs here or choose files. Detection is based on file contents, not filenames.</p>
        </div>
        <span className="badge-neutral">{files.length} files</span>
      </div>

      <button
        type="button"
        className={`dropzone ${isDragging ? "dropzone--active" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void onAnalyzeFiles(event.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          hidden
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={(event) => {
            if (event.target.files) {
              void onAnalyzeFiles(event.target.files);
              event.target.value = "";
            }
          }}
        />
        <span className="dropzone__eyebrow">PDF only</span>
        <strong>Drop ICICIdirect statements here</strong>
        <span>Or click to choose files from your device.</span>
      </button>

      <div className="queue">
        {files.length === 0 ? (
          <div className="empty-state">No files uploaded yet.</div>
        ) : (
          files.map((entry) => (
            <div className="file-row" key={entry.id}>
              <div className="file-row__meta">
                <div className="file-row__name">{entry.file.name}</div>
                <div className="file-row__sub">
                  <span>{formatBytes(entry.file.size)}</span>
                  <span
                    className={`kind-badge kind-badge--${
                      entry.detection?.displayKind.toLowerCase() ?? "unknown"
                    }`}
                  >
                    {entry.detection?.displayKind ?? "SCANNING"}
                  </span>
                  <span className={`status status--${entry.status}`}>{entry.status}</span>
                  {entry.detection?.statementPeriodText ? (
                    <span>{entry.detection.statementPeriodText}</span>
                  ) : null}
                </div>
                {entry.error ? <div className="file-row__error">{entry.error}</div> : null}
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => onRemoveFile(entry.id)}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
