"use client";

import { useState } from "react";
import { Button, HStack, Stack, Text, Thumbnail } from "@openseat/design-system";
import { Caption, Examples, Preview, Row, SAMPLE_IMAGES } from "./shared";

const ATTACHMENTS = [
  { id: "globe", src: SAMPLE_IMAGES.globe, label: "globe.svg" },
  { id: "window", src: SAMPLE_IMAGES.window, label: "window.svg" },
  { id: "file", src: SAMPLE_IMAGES.file, label: "file.svg" },
];
const UPLOAD_DELAY_MS = 1500;

export default function ThumbnailDemo() {
  const [files, setFiles] = useState(ATTACHMENTS);
  const [opened, setOpened] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const upload = () => {
    setUploaded(false);
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setUploaded(true);
    }, UPLOAD_DELAY_MS);
  };

  return (
    <Examples>
      <Preview align="start" label="States" description="Image on success, a placeholder with no src or on error, a shimmer while loading.">
        <Row>
          {[
            { caption: "Image", props: { src: SAMPLE_IMAGES.window, alt: "Window illustration" } },
            { caption: "No src", props: { label: "Untitled" } },
            { caption: "Broken src", props: { src: SAMPLE_IMAGES.missing, alt: "Missing image" } },
            { caption: "Loading", props: { isLoading: true, label: "Uploading" } },
            { caption: "Disabled", props: { src: SAMPLE_IMAGES.globe, alt: "Globe", isDisabled: true } },
          ].map(({ caption, props }) => (
            <Stack key={caption} gap={1} hAlign="center">
              <Thumbnail {...props} />
              <Caption>{caption}</Caption>
            </Stack>
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Label" description="label is the accessible name and the hover tooltip — usually the file name.">
        <Row>
          {ATTACHMENTS.map((file) => (
            <Thumbnail key={file.id} src={file.src} label={file.label} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Removable" description="The remove button shows on hover and focus by default, or always.">
        <Stack gap={3} hAlign="start">
          <Row>
            {files.map((file) => (
              <Thumbnail key={file.id} src={file.src} label={file.label} onRemove={() => setFiles((all) => all.filter((f) => f.id !== file.id))} />
            ))}
            {files.length === 0 && <Caption>All attachments removed.</Caption>}
          </Row>
          <Row>
            {ATTACHMENTS.map((file) => (
              <Thumbnail key={file.id} src={file.src} label={file.label} showRemoveOn="always" onRemove={() => undefined} />
            ))}
          </Row>
          <Button label="Reset" size="sm" variant="ghost" onClick={() => setFiles(ATTACHMENTS)} />
        </Stack>
      </Preview>

      <Preview align="start" label="Clickable" description="onClick opens a lightbox or detail view.">
        <Stack gap={2} hAlign="start">
          <Row>
            {ATTACHMENTS.map((file) => (
              <Thumbnail key={file.id} src={file.src} label={file.label} alt={file.label} onClick={() => setOpened(file.label)} />
            ))}
          </Row>
          <Caption>{opened ? `Opened ${opened}` : "Click a thumbnail."}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Upload flow" description="isLoading while the file uploads, then the image.">
        <HStack gap={3} vAlign="center">
          {uploading || uploaded ? (
            <Thumbnail isLoading={uploading} src={uploaded ? SAMPLE_IMAGES.file : undefined} label="brief.pdf" onRemove={() => setUploaded(false)} />
          ) : (
            <Thumbnail label="Nothing uploaded" isDisabled />
          )}
          <Button label={uploading ? "Uploading…" : "Upload"} size="sm" variant="secondary" isDisabled={uploading} onClick={upload} />
        </HStack>
      </Preview>

      <Preview align="start" label="Attachment row" description="Thumbnails with metadata underneath — a message or a bid.">
        <HStack gap={3} wrap="wrap">
          {ATTACHMENTS.map((file, index) => (
            <Stack key={file.id} gap={1}>
              <Thumbnail src={file.src} label={file.label} alt={file.label} />
              <Text type="supporting" display="block">
                {file.label}
              </Text>
              <Caption>{(index + 1) * 12} KB</Caption>
            </Stack>
          ))}
        </HStack>
      </Preview>
    </Examples>
  );
}
