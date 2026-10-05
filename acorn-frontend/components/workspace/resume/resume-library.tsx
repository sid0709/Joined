"use client";

import { useRef } from "react";
import {
  Badge,
  Banner,
  Button,
  FileUploader,
  Glyph,
  HStack,
  IconButton,
  SectionCard,
  Stack,
  StatGrid,
  Table,
  Text,
  formatBytes,
  type TableColumn,
} from "sid-ui";
import { LIBRARY_LIMIT, formatWhen, type LibraryResume } from "@/lib/workspace/model";
import { RESUME_ACCEPT, RESUME_MAX_BYTES } from "@/lib/workspace/resume-file";
import { useResumes } from "./use-resumes";

const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

/** Résumé files you uploaded. Generated drafts live in History. */
export function ResumeLibrary() {
  const { workspace, update, library, isSampleLibrary } = useResumes();
  const seen = useRef(new Set<string>());
  const saved = isSampleLibrary ? [] : library;
  const save = (items: LibraryResume[]) => {
    const withDefault =
      items.length > 0 && !items.some((item) => item.isDefault)
        ? items.map((item, index) => ({ ...item, isDefault: index === 0 }))
        : items;
    update({ ...workspace, library: withDefault });
  };

  const add = (files: File[]) => {
    const fresh = files.filter((file) => !seen.current.has(fileKey(file)));
    if (fresh.length === 0) return;
    fresh.forEach((file) => seen.current.add(fileKey(file)));
    const added: LibraryResume[] = fresh.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      detail: "Uploaded to the library",
      addedAt: new Date().toISOString(),
      size: file.size,
    }));
    save([...added, ...saved].slice(0, LIBRARY_LIMIT));
  };

  const makeDefault = (id: string) =>
    save(saved.map((item) => ({ ...item, isDefault: item.id === id })));
  const remove = (id: string) => save(saved.filter((item) => item.id !== id));

  const defaultFile = library.find((item) => item.isDefault) ?? library[0];
  const totalSize = library.reduce((sum, item) => sum + (item.size ?? 0), 0);

  const columns: TableColumn<LibraryResume>[] = [
    {
      key: "name",
      header: "File",
      sortable: true,
      render: (item) => (
        <HStack gap={2} vAlign="center">
          <Glyph name="file" />
          <Stack gap={0}>
            <Text weight="semibold">{item.name}</Text>
            <Text type="supporting" color="secondary">
              {item.detail}
            </Text>
          </Stack>
          {item.isDefault ? <Badge label="Default" variant="blue" /> : null}
        </HStack>
      ),
    },
    {
      key: "size",
      header: "Size",
      sortable: true,
      sortValue: (item) => item.size ?? 0,
      render: (item) => <Text color="secondary">{item.size ? formatBytes(item.size) : "—"}</Text>,
    },
    {
      key: "addedAt",
      header: "Added",
      sortable: true,
      render: (item) => <Text color="secondary">{formatWhen(item.addedAt)}</Text>,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (item) =>
        isSampleLibrary ? null : (
          <HStack gap={1} hAlign="end">
            {item.isDefault ? null : (
              <Button
                label="Make default"
                variant="ghost"
                size="sm"
                onClick={() => makeDefault(item.id)}
              />
            )}
            <IconButton
              label={`Remove ${item.name}`}
              icon={<Glyph name="trash" />}
              variant="ghost"
              size="sm"
              onClick={() => remove(item.id)}
            />
          </HStack>
        ),
    },
  ];

  return (
    <Stack gap={4}>
      <StatGrid
        stats={[
          { label: "Files", value: String(library.length), hint: `Up to ${LIBRARY_LIMIT}` },
          {
            label: "Default",
            value: defaultFile ? "Set" : "None",
            hint: defaultFile?.name ?? "Upload a file to set one",
          },
          { label: "Total size", value: totalSize ? formatBytes(totalSize) : "—" },
        ]}
      />
      {isSampleLibrary ? (
        <Banner
          status="info"
          title="Sample files"
          description="Upload your own résumé and these placeholders go away."
        />
      ) : null}
      <SectionCard
        title="Upload"
        description="PDF or text résumés. Acorn attaches the default one when a posting has no generated draft."
      >
        <FileUploader
          label="Résumé files"
          accept={RESUME_ACCEPT}
          maxSize={RESUME_MAX_BYTES}
          maxFiles={LIBRARY_LIMIT}
          onChange={add}
        />
      </SectionCard>
      <SectionCard
        title="Files"
        description="Only files you uploaded. Generated drafts are in History."
      >
        <Table
          caption="Resume library"
          variant="plain"
          columns={columns}
          rows={library}
          rowKey={(item) => item.id}
          defaultSort={{ key: "addedAt", direction: "desc" }}
          empty="No files yet. Upload a résumé above."
        />
      </SectionCard>
    </Stack>
  );
}
