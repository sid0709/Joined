"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, IconButton } from "./Action";
import { Kbd, Thumbnail } from "./Content";
import { Badge, Banner, ProgressBar } from "./Feedback";
import { icons } from "./Glyph";
import { Card, HStack, Icon, Stack, Text } from "./Primitives";
import { formatBytes, matchesAccept, useFileDrop } from "./useFileDrop";

export type UploadStatus = "uploading" | "done" | "error";

export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  /** 0–100 while uploading. */
  progress: number;
  error?: string;
  /** Object URL for image previews; revoked when the item is removed. */
  previewUrl?: string;
}

/** Upload one file, reporting 0–100 as it goes. Throw to mark the file as failed. */
export type UploadHandler = (file: File, onProgress: (percent: number) => void) => Promise<void>;

export interface FileUploaderProps {
  label: string;
  description?: string;
  /** Same syntax as the input attribute, e.g. ".pdf,image/*". */
  accept?: string;
  /** Largest file in bytes. */
  maxSize?: number;
  maxFiles?: number;
  /** Accept several files. Defaults to true. */
  isMultiple?: boolean;
  isDisabled?: boolean;
  /** Accept files pasted from the clipboard while the uploader has focus. */
  hasPaste?: boolean;
  /** Runs for each accepted file. Without it, files are ready as soon as they are added. */
  upload?: UploadHandler;
  /** Called with every successfully uploaded file, in order. */
  onChange?: (files: File[]) => void;
  /** dropzone is the large target; compact is a single row for dense forms. */
  variant?: "dropzone" | "compact";
  /** list shows name, size, and progress; grid shows image thumbnails. */
  layout?: "list" | "grid";
  /** Replaces the default hint under the prompt. */
  hint?: ReactNode;
}

const PERCENT = 100;

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function describeLimits(accept?: string, maxSize?: number, maxFiles?: number) {
  const parts = [
    accept && accept.split(",").map((t) => t.trim().replace(/^\./, "").replace("/*", "").toUpperCase()).join(", "),
    maxSize && `up to ${formatBytes(maxSize)}`,
    maxFiles && `${maxFiles} file${maxFiles === 1 ? "" : "s"} max`,
  ];
  return parts.filter(Boolean).join(" · ");
}

/**
 * Drag-and-drop uploader. Drop files, browse, or paste; each accepted file
 * uploads with its own progress, preview, retry, and remove. Built only from
 * Astryx parts, so it follows the theme.
 */
export function FileUploader({
  label,
  description,
  accept,
  maxSize,
  maxFiles,
  isMultiple = true,
  isDisabled = false,
  hasPaste = false,
  upload,
  onChange,
  variant = "dropzone",
  layout = "list",
  hint,
}: FileUploaderProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const patch = useCallback((id: string, next: Partial<UploadItem>) => {
    setItems((all) => all.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }, []);

  const run = useCallback(
    async (item: UploadItem) => {
      if (!upload) {
        patch(item.id, { status: "done", progress: PERCENT });
        return;
      }
      patch(item.id, { status: "uploading", progress: 0, error: undefined });
      try {
        await upload(item.file, (percent) => patch(item.id, { progress: Math.min(PERCENT, Math.max(0, percent)) }));
        patch(item.id, { status: "done", progress: PERCENT });
      } catch (error) {
        patch(item.id, { status: "error", error: error instanceof Error ? error.message : "Upload failed." });
      }
    },
    [patch, upload],
  );

  const add = useCallback(
    (incoming: File[]) => {
      const reasons: string[] = [];
      const room = maxFiles ? Math.max(0, maxFiles - itemsRef.current.length) : Infinity;
      const accepted: UploadItem[] = [];
      for (const file of isMultiple ? incoming : incoming.slice(0, 1)) {
        if (!matchesAccept(file, accept)) reasons.push(`${file.name} isn’t an accepted type.`);
        else if (maxSize && file.size > maxSize) reasons.push(`${file.name} is over ${formatBytes(maxSize)}.`);
        else if (accepted.length >= room) reasons.push(`${file.name} is over the ${maxFiles}-file limit.`);
        else
          accepted.push({
            id: `upload-${nextId.current++}`,
            file,
            status: "uploading",
            progress: 0,
            previewUrl: isImage(file) ? URL.createObjectURL(file) : undefined,
          });
      }
      setRejected(reasons);
      if (!accepted.length) return;
      setItems((all) => {
        const replaced = isMultiple ? all : [];
        if (!isMultiple) all.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
        return [...replaced, ...accepted];
      });
      accepted.forEach(run);
    },
    [accept, isMultiple, maxFiles, maxSize, run],
  );

  const remove = (id: string) => {
    setItems((all) => {
      const gone = all.find((item) => item.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return all.filter((item) => item.id !== id);
    });
  };

  // Report finished files whenever the set of done uploads changes.
  const doneKey = items
    .filter((item) => item.status === "done")
    .map((item) => item.id)
    .join();
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onChangeRef.current?.(itemsRef.current.filter((item) => item.status === "done").map((item) => item.file));
  }, [doneKey]);

  // Revoke any previews left when the uploader unmounts.
  useEffect(() => () => itemsRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl)), []);

  const { isDragging, dropProps } = useFileDrop({ onFiles: add, isDisabled, hasPaste });
  const full = maxFiles != null && items.length >= maxFiles;
  const limits = hint ?? describeLimits(accept, maxSize, maxFiles);
  const browse = () => inputRef.current?.click();
  const done = items.filter((item) => item.status === "done").length;

  const picker = (
    <input
      ref={inputRef}
      type="file"
      hidden
      accept={accept}
      multiple={isMultiple}
      disabled={isDisabled}
      onChange={(event) => {
        add(Array.from(event.target.files ?? []));
        event.target.value = "";
      }}
    />
  );

  const target =
    variant === "compact" ? (
      <Card variant={isDragging ? "blue" : "muted"} padding={3}>
        <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
          <HStack gap={2} vAlign="center">
            <Icon icon={icons.upload} color={isDragging ? "accent" : "secondary"} />
            <Stack gap={0}>
              <Text weight="semibold">{isDragging ? "Drop to upload" : "Drag files here"}</Text>
              {limits && (
                <Text type="supporting" color="secondary">
                  {limits}
                </Text>
              )}
            </Stack>
          </HStack>
          <Button label="Browse" size="sm" onClick={browse} isDisabled={isDisabled || full} />
        </HStack>
      </Card>
    ) : (
      <Card variant={isDragging ? "blue" : "muted"} padding={6} elevation={isDragging ? "low" : "none"}>
        <Stack gap={2} hAlign="center">
          <Icon icon={icons.upload} size="lg" color={isDragging ? "accent" : "secondary"} />
          <Text weight="semibold" justify="center">
            {isDragging ? "Drop to upload" : full ? "File limit reached" : "Drag and drop files here"}
          </Text>
          {limits && (
            <Text type="supporting" color="secondary" justify="center">
              {limits}
            </Text>
          )}
          <HStack gap={2} vAlign="center" wrap="wrap" hAlign="center">
            <Button label="Browse files" variant="secondary" size="sm" icon={<Icon icon={icons.folderOpen} />} onClick={browse} isDisabled={isDisabled || full} />
            {hasPaste && (
              <Text type="supporting" color="secondary">
                or paste with <Kbd keys="mod+v" />
              </Text>
            )}
          </HStack>
        </Stack>
      </Card>
    );

  return (
    <Stack gap={3}>
      <Stack gap={0.5}>
        <Text type="label">{label}</Text>
        {description && (
          <Text type="supporting" color="secondary">
            {description}
          </Text>
        )}
      </Stack>
      <div {...dropProps} aria-disabled={isDisabled || undefined} aria-label={label} role="group">
        {picker}
        {target}
      </div>
      {rejected.length > 0 && (
        <Banner
          status="error"
          title={`${rejected.length} file${rejected.length === 1 ? " wasn’t" : "s weren’t"} added`}
          description={rejected.join(" ")}
          isDismissable
          onDismiss={() => setRejected([])}
        />
      )}
      {items.length > 0 &&
        (layout === "grid" ? (
          <HStack gap={3} wrap="wrap">
            {items.map((item) => (
              <Stack key={item.id} gap={1} width={96}>
                <Thumbnail
                  src={item.previewUrl}
                  alt={item.file.name}
                  label={item.file.name}
                  isLoading={item.status === "uploading"}
                  onRemove={() => remove(item.id)}
                />
                <Text type="supporting" color={item.status === "error" ? "accent" : "secondary"} maxLines={1}>
                  {item.status === "error" ? "Failed" : item.file.name}
                </Text>
              </Stack>
            ))}
          </HStack>
        ) : (
          <Stack gap={2}>
            {items.map((item) => (
              <Card key={item.id} padding={3}>
                <HStack gap={3} vAlign="center">
                  <Thumbnail src={item.previewUrl} alt={item.file.name} label={item.file.name} />
                  <Stack gap={1} width="100%">
                    <HStack gap={2} vAlign="center" hAlign="between">
                      <Text weight="semibold" maxLines={1}>
                        {item.file.name}
                      </Text>
                      {item.status === "done" && <Badge label="Uploaded" variant="success" icon={<Icon icon={icons.check} size="xsm" />} />}
                      {item.status === "error" && <Badge label="Failed" variant="error" />}
                    </HStack>
                    {item.status === "uploading" ? (
                      <ProgressBar label={`Uploading ${item.file.name}`} isLabelHidden value={item.progress} />
                    ) : (
                      <Text type="supporting" color="secondary">
                        {item.status === "error" ? item.error : formatBytes(item.file.size)}
                      </Text>
                    )}
                  </Stack>
                  {item.status === "error" && (
                    <IconButton label={`Retry ${item.file.name}`} variant="ghost" size="sm" icon={<Icon icon={icons.refresh} />} onClick={() => run(item)} />
                  )}
                  <IconButton label={`Remove ${item.file.name}`} variant="ghost" size="sm" icon={<Icon icon={icons.close} />} onClick={() => remove(item.id)} />
                </HStack>
              </Card>
            ))}
            {items.length > 1 && (
              <Text type="supporting" color="secondary">
                {done} of {items.length} uploaded
              </Text>
            )}
          </Stack>
        ))}
    </Stack>
  );
}
