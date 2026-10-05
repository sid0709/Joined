import { useEffect, useState } from "react";
import { Banner, Button, Drawer, Glyph, HStack, Spinner } from "sid-ui";
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
    <Drawer
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Generated résumé · ${title}`}
      size="full"
      footer={
        <HStack gap={2} justify="end">
          <Button
            variant="secondary"
            icon={<Glyph name="download" />}
            label="Download Word"
            isDisabled={busy}
            onClick={() => void download()}
          />
          <Button variant="primary" label="Close" onClick={onClose} />
        </HStack>
      }
    >
      {busy ? <Spinner label="Loading preview…" /> : null}
      {error ? (
        <Banner status="error" title="Couldn’t load the résumé" description={error} />
      ) : null}
      {html ? (
        <iframe
          className="resume-preview-frame"
          title={`Generated résumé for ${title}`}
          sandbox=""
          srcDoc={html}
        />
      ) : null}
    </Drawer>
  );
}
