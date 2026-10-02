import { useState } from "react";
import { Banner, Button, Card, HStack, Text, TextArea, VStack } from "@joined/design-system";
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
    <VStack as="section" gap={3} className="qa-panel">
      {showHeading ? (
        <Text as="h3" weight="semibold">
          Q&amp;A
        </Text>
      ) : null}
      <Text type="supporting">
        If Fill leaves a field blank, paste the question and copy a human-like answer.
      </Text>
      <TextArea
        label="Unanswered question"
        isLabelHidden
        value={question}
        onChange={(value) => setQuestion(value)}
        placeholder="Paste the unanswered field question…"
        rows={4}
        isDisabled={!signedIn || busy || disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void generate();
          }
        }}
      />
      <HStack gap={2}>
        <Button
          variant="primary"
          label={busy ? "Writing…" : "Generate"}
          isLoading={busy}
          isDisabled={!signedIn || busy || disabled || !question.trim()}
          width="100%"
          onClick={() => void generate()}
        />
        <Button
          variant="secondary"
          label={copied ? "Copied" : "Copy"}
          isDisabled={!answer || busy}
          width="100%"
          onClick={() => void copy()}
        />
      </HStack>
      {error ? (
        <Banner status="error" title="Couldn’t write an answer" description={error} />
      ) : null}
      {answer ? (
        <Card variant="muted" padding={3}>
          <Text as="p" textWrap="pretty" className="qa-answer">
            {answer}
          </Text>
        </Card>
      ) : null}
    </VStack>
  );
}
