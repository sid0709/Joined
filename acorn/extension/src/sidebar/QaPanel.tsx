import { useState } from "react";
import { FACE_SMILE_MS } from "../acorn-face/constants";
import { flashAcornFace } from "../acorn-face/face-flash";
import { requestQaAnswer, type AcornQaPage } from "../pipeline/ai-client";

type QaPanelProps = {
  signedIn: boolean;
  page?: AcornQaPage | null;
  disabled?: boolean;
  showHeading?: boolean;
  onStatus?: (status: { busy: boolean; error: boolean }) => void;
};

export function QaPanel({ signedIn, page, disabled, showHeading = true, onStatus }: QaPanelProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (busy || !signedIn || disabled) return;
    setBusy(true);
    onStatus?.({ busy: true, error: false });
    setError(null);
    setCopied(false);
    try {
      const next = await requestQaAnswer({ question, page: page ?? null });
      setAnswer(next);
      onStatus?.({ busy: false, error: false });
    } catch (err) {
      setAnswer("");
      setError(err instanceof Error ? err.message : String(err));
      onStatus?.({ busy: false, error: true });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!answer) return;
    await navigator.clipboard.writeText(answer);
    setCopied(true);
    flashAcornFace({ mode: "smile", ms: FACE_SMILE_MS });
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="qa-panel">
      {showHeading ? <h3>Q&amp;A</h3> : null}
      <p className="hint">
        If Fill leaves a field blank, paste the question and copy a human-like answer.
      </p>
      <textarea
        className="qa-question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Paste the unanswered field question…"
        disabled={!signedIn || busy || disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void generate();
          }
        }}
      />
      <div className="qa-actions">
        <button
          type="button"
          className="tool-card primary"
          disabled={!signedIn || busy || disabled || !question.trim()}
          onClick={() => void generate()}
        >
          {busy ? "Writing…" : "Generate"}
        </button>
        <button
          type="button"
          className="tool-card"
          disabled={!answer || busy}
          onClick={() => void copy()}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {error ? <p className="qa-error">{error}</p> : null}
      {answer ? <pre className="qa-answer">{answer}</pre> : null}
    </section>
  );
}
