"use client";

import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  HStack,
  Icon,
  Stack,
  Text,
  TextArea,
  icons,
  type TextAreaSize,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const SIZES: TextAreaSize[] = ["sm", "md", "lg"];
const FIELD_WIDTH = 420;
const BIO_MAX = 160;
const PITCH_MIN = 40;
const AUTOSAVE_MS = 800;

export default function TextAreaDemo() {
  const [sizes, setSizes] = useState<Record<TextAreaSize, string>>({ sm: "", md: "", lg: "" });
  const [bio, setBio] = useState("Copywriter for climate and food brands. Short sentences, long research.");
  const [pitch, setPitch] = useState("I can start Monday.");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [reply, setReply] = useState("");
  const [thread, setThread] = useState<string[]>(["Can you share the brand guidelines?"]);

  useEffect(() => {
    if (saved !== "saving") return;
    const id = setTimeout(() => setSaved("saved"), AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [note, saved]);

  const pitchStatus =
    pitch.length === 0
      ? undefined
      : pitch.length < PITCH_MIN
        ? ({ type: "warning", message: `A few more words — ${PITCH_MIN - pitch.length} characters to go.` } as const)
        : ({ type: "success", message: "Great detail." } as const);

  return (
    <Examples>
      <Preview align="start" label="Sizes" description="The text size and padding follow sm, md, and lg.">
        <Stack gap={3} width={FIELD_WIDTH}>
          {SIZES.map((size) => (
            <TextArea key={size} size={size} label={`Size ${size}`} rows={2} placeholder="What does great look like?" value={sizes[size]} onChange={(v) => setSizes((c) => ({ ...c, [size]: v }))} />
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Rows" description="rows sets the starting height.">
        <HStack gap={3} wrap="wrap" vAlign="start">
          {[2, 4, 8].map((rows) => (
            <Stack key={rows} width={200}>
              <TextArea label={`${rows} rows`} rows={rows} value="" onChange={() => undefined} />
            </Stack>
          ))}
        </HStack>
      </Preview>

      <Preview align="start" label="Character limit" description="maxLength caps the text and shows a live count.">
        <Stack width={FIELD_WIDTH}>
          <TextArea label="Bio" description="Shown on your public profile." value={bio} onChange={setBio} maxLength={BIO_MAX} rows={3} />
        </Stack>
      </Preview>

      <Preview align="start" label="Guided status" description="Status updates as people type — warning while short, success when there’s enough.">
        <Stack width={FIELD_WIDTH}>
          <TextArea label="Your pitch" isRequired value={pitch} onChange={setPitch} status={pitchStatus} rows={4} />
        </Stack>
      </Preview>

      <Preview align="start" label="States" description="error, read-only, and disabled with a reason.">
        <Stack gap={3} width={FIELD_WIDTH}>
          <TextArea label="Scope" value="" onChange={() => undefined} status={{ type: "error", message: "Describe the scope before publishing." }} />
          <TextArea label="Original brief" value="A full identity refresh for a regional coffee roaster." onChange={() => undefined} isReadOnly rows={2} />
          <TextArea label="Award note" value="" onChange={() => undefined} isDisabled disabledMessage="Available after the room closes." rows={2} />
        </Stack>
      </Preview>

      <Preview align="start" label="Autosave" description="Save as people type, and say so under the field.">
        <Stack gap={1} width={FIELD_WIDTH}>
          <TextArea label="Private notes" labelTooltip="Only you can see these." value={note} onChange={(v) => { setNote(v); setSaved("saving"); }} placeholder="Jot down thoughts about each bid…" rows={4} hasSpellCheck />
          <HStack gap={1} vAlign="center">
            {saved === "saved" && <Icon icon={icons.check} size="sm" color="success" />}
            <Caption>{saved === "idle" ? "Notes save automatically." : saved === "saving" ? "Saving…" : "Saved"}</Caption>
          </HStack>
        </Stack>
      </Preview>

      <Preview label="Reply composer" description="A hidden label, a send action, and the thread above it.">
        <Card maxWidth={480}>
          <Stack gap={3}>
            {thread.map((message, index) => (
              <HStack key={index} gap={2} vAlign="start">
                <Avatar name={index % 2 ? "Jordan Miles" : "Dana Kim"} size="sm" tooltip={false} />
                <Text>{message}</Text>
              </HStack>
            ))}
            <TextArea label="Reply" isLabelHidden placeholder="Write a reply…" value={reply} onChange={setReply} rows={2} />
            <HStack hAlign="end" gap={2}>
              <Button label="Attach" variant="ghost" size="sm" icon={<Icon icon={icons.upload} />} />
              <Button
                label="Send"
                variant="primary"
                size="sm"
                icon={<Icon icon={icons.send} />}
                isDisabled={!reply.trim()}
                onClick={() => {
                  setThread((t) => [...t, reply.trim()]);
                  setReply("");
                }}
              />
            </HStack>
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
