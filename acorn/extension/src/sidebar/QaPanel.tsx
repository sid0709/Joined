import { useState } from "react";
import {
  Button,
  ChatComposer,
  ChatLayout,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatSystemMessage,
  EmptyState,
  Glyph,
  Stack,
} from "sid-ui";
import { FACE_SMILE_MS } from "../acorn-face/constants";
import { flashAcornFace } from "../acorn-face/face-flash";
import { requestQaAnswer, type AcornQaPage } from "../pipeline/api/qa";

type QaPanelProps = {
  signedIn: boolean;
  page?: AcornQaPage | null;
  disabled?: boolean;
  onStatus?: (status: { busy: boolean; error: boolean }) => void;
};

/**
 * Ask: paste a form question Fill left blank and get a human-sounding answer to copy,
 * as a short chat thread.
 */
export function QaPanel({ signedIn, page, disabled, onStatus }: QaPanelProps) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async (text: string) => {
    if (busy || !signedIn || disabled || !text.trim()) return;
    setBusy(true);
    onStatus?.({ busy: true, error: false });
    setAsked(text);
    setQuestion("");
    setError(null);
    setCopied(false);
    try {
      const next = await requestQaAnswer({ question: text, page: page ?? null });
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
    <Stack height="100%" className="acorn-ask">
      <ChatLayout
        emptyState={
          <EmptyState
            isCompact
            icon={<Glyph name="chat" />}
            title="Ask about a blank field"
            description="Paste a question Fill left empty and copy a human-sounding answer."
          />
        }
        composer={
          <ChatComposer
            value={question}
            onChange={setQuestion}
            onSubmit={(text) => void generate(text)}
            isDisabled={!signedIn || busy || disabled}
            placeholder="Paste the unanswered field question…"
            density="compact"
          />
        }
      >
        {asked ? (
          <ChatMessageList>
            <ChatMessage sender="user">
              <ChatMessageBubble>{asked}</ChatMessageBubble>
            </ChatMessage>
            {busy ? (
              <ChatMessage sender="assistant">
                <ChatMessageBubble variant="ghost">Writing…</ChatMessageBubble>
              </ChatMessage>
            ) : null}
            {error ? (
              <ChatSystemMessage icon={<Glyph name="info" />}>{error}</ChatSystemMessage>
            ) : null}
            {answer ? (
              <ChatMessage sender="assistant">
                <ChatMessageBubble
                  metadata={
                    <Button
                      variant="ghost"
                      size="sm"
                      label={copied ? "Copied" : "Copy"}
                      icon={<Glyph name={copied ? "check" : "share"} />}
                      isDisabled={busy}
                      onClick={() => void copy()}
                    />
                  }
                >
                  <span className="qa-answer">{answer}</span>
                </ChatMessageBubble>
              </ChatMessage>
            ) : null}
          </ChatMessageList>
        ) : null}
      </ChatLayout>
    </Stack>
  );
}
