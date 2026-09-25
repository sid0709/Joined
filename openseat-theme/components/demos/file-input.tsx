"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  FileInput,
  FileUploader,
  HStack,
  Heading,
  Icon,
  Stack,
  Text,
  TextInput,
  formatBytes,
  icons,
  useFileDrop,
  type UploadHandler,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const FIELD_WIDTH = 420;
const KB = 1024;
const MB = KB * KB;
const MAX_IMAGE = 2 * MB;
const MAX_FILES = 3;
const UPLOAD_MS = 1200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const TICK_MS = 120;
const TICKS = 12;
const PERCENT = 100;

/** A fake upload that reports progress; any file named with “fail” errors halfway. */
const simulateUpload: UploadHandler = async (file, onProgress) => {
  for (let tick = 1; tick <= TICKS; tick++) {
    await wait(TICK_MS);
    if (file.name.toLowerCase().includes("fail") && tick === TICKS / 2) throw new Error("The server rejected this file. Try again.");
    onProgress((tick / TICKS) * PERCENT);
  }
};

/** Local object URL for a picked image, revoked when it changes. */
function usePreview(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

function AvatarDrop() {
  const [photo, setPhoto] = useState<File | null>(null);
  const src = usePreview(photo);
  const { isDragging, dropProps } = useFileDrop({ onFiles: (files) => setPhoto(files.find((f) => f.type.startsWith("image/")) ?? null) });
  return (
    <div {...dropProps}>
      <Card variant={isDragging ? "blue" : "default"} width={320}>
        <HStack gap={3} vAlign="center">
          <Avatar name="Dana Kim" src={src} size="xl" tooltip={false} />
          <Stack gap={1}>
            <Text weight="semibold">{isDragging ? "Drop to set photo" : "Profile photo"}</Text>
            <Text type="supporting" color="secondary">
              Drag an image onto this card.
            </Text>
            {photo && <Button label="Remove" size="sm" variant="ghost" onClick={() => setPhoto(null)} />}
          </Stack>
        </HStack>
      </Card>
    </div>
  );
}

function DropAnywhere() {
  const [dropped, setDropped] = useState<File[]>([]);
  const { isDragging, dropProps } = useFileDrop({ onFiles: (files) => setDropped((d) => [...d, ...files]) });
  return (
    <div {...dropProps}>
      <Card variant={isDragging ? "blue" : "default"} elevation={isDragging ? "med" : "none"}>
        <Stack gap={3}>
          <HStack hAlign="between" vAlign="center">
            <Heading level={4}>Brand refresh · Files</Heading>
            <Badge label={isDragging ? "Drop anywhere" : `${dropped.length} files`} variant={isDragging ? "info" : "neutral"} />
          </HStack>
          <Text color="secondary">The whole card is a drop target — no drop zone needed. Drag files from your desktop onto it.</Text>
          {dropped.map((f, i) => (
            <HStack key={f.name + i} gap={2} vAlign="center" hAlign="between">
              <HStack gap={2} vAlign="center">
                <Icon icon={icons.file} size="sm" color="secondary" />
                <Text>{f.name}</Text>
              </HStack>
              <Caption>{formatBytes(f.size)}</Caption>
            </HStack>
          ))}
        </Stack>
      </Card>
    </div>
  );
}

function asList(value: File | File[] | null): File[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function size(bytes: number) {
  return bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / KB))} KB`;
}

function FileSummary({ files }: { files: File[] }) {
  if (!files.length) return <Caption>No files yet.</Caption>;
  return (
    <Stack gap={1}>
      {files.map((file) => (
        <HStack key={file.name + file.size} hAlign="between">
          <Text>{file.name}</Text>
          <Caption>{size(file.size)}</Caption>
        </HStack>
      ))}
    </Stack>
  );
}

export default function FileInputDemo() {
  const [brief, setBrief] = useState<File | File[] | null>(null);
  const [inline, setInline] = useState<File | File[] | null>(null);
  const [images, setImages] = useState<File | File[] | null>(null);
  const [capped, setCapped] = useState<File | File[] | null>(null);
  const [uploaded, setUploaded] = useState<File | File[] | null>(null);
  const [avatar, setAvatar] = useState<File | File[] | null>(null);
  const [title, setTitle] = useState("Brand refresh");
  const [tried, setTried] = useState(false);
  const [ready, setReady] = useState<File[]>([]);

  return (
    <Examples>
      <Preview label="Drag-and-drop uploader" description="FileUploader: drop, browse, or paste (⌘V). Each file uploads with its own progress, then can be removed. Name a file with “fail” to see retry.">
        <Stack gap={2} maxWidth={560}>
          <FileUploader
            label="Attachments"
            description="Share references and briefs with bidders."
            accept=".pdf,.png,.jpg,.jpeg,.svg,.docx"
            maxSize={10 * MB}
            maxFiles={6}
            hasPaste
            upload={simulateUpload}
            onChange={setReady}
          />
          <Caption>{ready.length ? `Ready: ${ready.map((f) => f.name).join(", ")}` : "Nothing uploaded yet."}</Caption>
        </Stack>
      </Preview>

      <Preview label="Image gallery" description="layout=&quot;grid&quot; shows image previews as thumbnails while they upload.">
        <Stack maxWidth={560}>
          <FileUploader label="Moodboard" accept="image/*" maxSize={MAX_IMAGE} upload={simulateUpload} layout="grid" hint="Images up to 2 MB — drop a whole folder’s worth." />
        </Stack>
      </Preview>

      <Preview label="Compact and single" description="variant=&quot;compact&quot; for forms; isMultiple={false} replaces the file on each drop.">
        <Stack gap={4} maxWidth={560}>
          <FileUploader label="Signed contract" variant="compact" accept=".pdf" isMultiple={false} upload={simulateUpload} />
          <FileUploader label="Invoices" variant="compact" accept=".pdf,.csv" maxFiles={3} />
          <FileUploader label="Final files" variant="compact" isDisabled hint="Available after the room is awarded." />
        </Stack>
      </Preview>

      <Preview label="Any element as a drop target" description="useFileDrop turns your own layout into a drop zone — a profile card or a whole panel.">
        <HStack gap={4} wrap="wrap" vAlign="start">
          <AvatarDrop />
          <Stack width={380}>
            <DropAnywhere />
          </Stack>
        </HStack>
      </Preview>

      <Preview align="start" label="Drop zone" description="The default: drag files in or click to browse.">
        <Stack gap={2} width={FIELD_WIDTH}>
          <FileInput label="Brief" value={brief} onChange={setBrief} description="PDF or Word, one file." accept=".pdf,.doc,.docx" />
          <FileSummary files={asList(brief)} />
        </Stack>
      </Preview>

      <Preview align="start" label="Input mode" description="mode=&quot;input&quot; is a compact field for forms without room for a drop zone.">
        <Stack gap={2} width={FIELD_WIDTH}>
          <FileInput label="Signed contract" mode="input" value={inline} onChange={setInline} placeholder="Choose a PDF" accept="application/pdf" />
        </Stack>
      </Preview>

      <Preview align="start" label="Several files" description="isMultiple accepts many; maxFiles and maxSize reject extras with a status message.">
        <Stack gap={4} width={FIELD_WIDTH}>
          <Stack gap={2}>
            <FileInput label="Moodboard images" isMultiple accept="image/*" maxSize={MAX_IMAGE} value={images} onChange={setImages} description={`Images up to ${size(MAX_IMAGE)} each.`} />
            <FileSummary files={asList(images)} />
          </Stack>
          <FileInput label={`Up to ${MAX_FILES} attachments`} isMultiple maxFiles={MAX_FILES} value={capped} onChange={setCapped} />
        </Stack>
      </Preview>

      <Preview align="start" label="Upload on select" description="changeAction shows loading while the upload runs.">
        <Stack gap={2} width={FIELD_WIDTH}>
          <FileInput
            label="Portfolio"
            value={uploaded}
            changeAction={async (files) => {
              await wait(UPLOAD_MS);
              setUploaded(files);
            }}
            onChange={() => undefined}
            status={asList(uploaded).length ? { type: "success", message: "Uploaded." } : undefined}
          />
        </Stack>
      </Preview>

      <Preview align="start" label="States" description="Required with an error, optional, and disabled with a reason.">
        <Stack gap={3} width={FIELD_WIDTH}>
          <FileInput label="W-9 form" mode="input" isRequired value={null} onChange={() => undefined} status={{ type: "error", message: "Upload a W-9 before your first payout." }} />
          <FileInput label="Cover letter" mode="input" isOptional value={null} onChange={() => undefined} labelTooltip="Owners read this before your bid." />
          <FileInput label="Final files" isDisabled disabledMessage="Available after the room is awarded." value={null} onChange={() => undefined} />
        </Stack>
      </Preview>

      <Preview label="Submit a bid" description="A file input in a real form, validated on submit.">
        <Card maxWidth={FIELD_WIDTH + 40}>
          <Stack gap={3}>
            <Heading level={4}>Submit your bid</Heading>
            <TextInput label="Room" value={title} onChange={setTitle} isReadOnly />
            <FileInput
              label="Proposal"
              isRequired
              accept=".pdf"
              value={avatar}
              onChange={setAvatar}
              status={tried && !asList(avatar).length ? { type: "error", message: "Attach your proposal as a PDF." } : undefined}
            />
            <HStack hAlign="end">
              <Button label="Submit bid" variant="primary" onClick={() => setTried(true)} />
            </HStack>
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
