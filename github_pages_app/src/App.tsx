import { AppHeader } from "./components/AppHeader";
import { InfoBanner } from "./components/InfoBanner";
import { OptionsPanel } from "./components/OptionsPanel";
import { ProgressPanel } from "./components/ProgressPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { RunPanel } from "./components/RunPanel";
import { UploadPanel } from "./components/UploadPanel";
import { WarningsPanel } from "./components/WarningsPanel";
import { useMvpWorkspace } from "./hooks/useMvpWorkspace";

function App() {
  const {
    uploadedFiles,
    options,
    statusText,
    progressPercent,
    isGenerating,
    warnings,
    results,
    canGenerate,
    analyzeFiles,
    removeFile,
    updateOption,
    generatePreview,
  } = useMvpWorkspace();

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="page">
        <InfoBanner />

        <section className="content-grid">
          <div className="stack">
            <UploadPanel
              files={uploadedFiles}
              onAnalyzeFiles={analyzeFiles}
              onRemoveFile={removeFile}
            />
          </div>

          <div className="stack">
            <OptionsPanel options={options} onOptionChange={updateOption} />
          </div>
        </section>

        <RunPanel
          canGenerate={canGenerate}
          isGenerating={isGenerating}
          onGenerate={generatePreview}
        />
        <ProgressPanel
          statusText={statusText}
          progressPercent={progressPercent}
        />
        <ResultsPanel results={results} />
        <WarningsPanel warnings={warnings} />
      </main>
    </div>
  );
}

export default App;
