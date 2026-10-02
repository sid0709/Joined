import { useEffect, useState } from "react";
import { triggerResumeDownload } from "./download-resume";

export type ResumePreviewDownload = {
  name: string;
  mimeType?: string | null;
  base64: string;
};

type ResumePreviewPanelProps = {
  title: string;
  sourceKey: string;
  loadHtml: () => Promise<string>;
  downloadFile: () => Promise<ResumePreviewDownload>;
  onClose: () => void;
};

export function ResumePreviewPanel({
  title,
  sourceKey,
  loadHtml,
  downloadFile,
  onClose,
}: ResumePreviewPanelProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError(null);
    setHtml(null);
    void loadHtml()
      .then((next) => {
        if (alive) setHtml(next);
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [sourceKey, loadHtml]);

  const download = async () => {
    try {
      const file = await downloadFile();
      if (!file?.base64 || !file.name) {
        setError("Could not download the generated résumé");
        return;
      }
      triggerResumeDownload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="inspect-panel resume-preview-panel">
      <header className="inspect-header">
        <h3>Generated résumé · {title}</h3>
        <button type="button" className="inspect-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div className="inspect-body resume-preview-body">
        {busy ? <p className="hint">Loading preview…</p> : null}
        {error ? <p className="resume-preview-error">{error}</p> : null}
        {html ? (
          <iframe
            className="resume-preview-frame"
            title={`Generated résumé for ${title}`}
            sandbox=""
            srcDoc={html}
          />
        ) : null}
      </div>
      <footer className="inspect-footer">
        <button type="button" disabled={busy} onClick={() => void download()}>
          Download Word
        </button>
        <button type="button" className="primary" onClick={onClose}>
          Close
        </button>
      </footer>
    </div>
  );
}
