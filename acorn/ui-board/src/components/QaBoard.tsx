import { useState } from "react";
import { requestQaAnswer, type BashQaPage } from "../ai-client";
import "./QaBoard.css";

type QaBoardProps = {
  signedIn: boolean;
  page?: BashQaPage | null;
};

export function QaBoard({ signedIn, page }: QaBoardProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (busy || !signedIn) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const next = await requestQaAnswer({ question, page: page ?? null });
      setAnswer(next);
    } catch (err) {
      setAnswer("");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!answer) return;
    await navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside className="qa-board">
      <h3>Q&amp;A</h3>
      <p className="qa-hint">
        Ask a leftover application question. Uses the same human-like writer as Bash text-field
        fill.
      </p>
      <textarea
        className="qa-question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Paste the unanswered field question…"
        disabled={!signedIn || busy}
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
          className="qa-generate"
          disabled={!signedIn || busy || !question.trim()}
          onClick={() => void generate()}
        >
          {busy ? "Writing…" : "Generate answer"}
        </button>
        <button
          type="button"
          className="qa-copy"
          disabled={!answer || busy}
          onClick={() => void copy()}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {!signedIn ? (
        <p className="qa-status">Sign in to generate answers.</p>
      ) : error ? (
        <p className="qa-status error">{error}</p>
      ) : null}
      {answer ? <pre className="qa-answer">{answer}</pre> : null}
    </aside>
  );
}
