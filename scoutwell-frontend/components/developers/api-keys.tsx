"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  Badge,
  Banner,
  Button,
  CodeBlock,
  Dialog,
  DialogHeader,
  EmptyState,
  HStack,
  Stack,
  Table,
  Text,
  TextInput,
  useToast,
  type TableColumn,
} from "@joined/design-system";
import { ApiError, type ApiKey, type CreatedApiKey } from "@joined/scout";
import { formatDateTime, formatDay } from "@/lib/dates";
import { scoutSend } from "@/lib/scout/client";

const DIALOG_WIDTH = 520;

/** Create, list, and revoke the scout's API keys. A secret is shown exactly once. */
export function ApiKeys({ keys }: { keys: ApiKey[] }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);

  const create = async () => {
    setError("");
    try {
      const key = await scoutSend<CreatedApiKey>("/api-keys", "POST", { name });
      setCreated(key);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the key.");
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    try {
      await scoutSend(`/api-keys/${revoking.id}`, "DELETE");
      toast({ body: `Revoked ${revoking.name}.` });
      setRevoking(null);
      router.refresh();
    } catch (err) {
      toast({
        body: err instanceof ApiError ? err.message : "Could not revoke the key.",
        type: "error",
      });
    }
  };

  const close = () => {
    setCreating(false);
    setCreated(null);
    setError("");
  };

  const columns: TableColumn<ApiKey>[] = [
    {
      key: "name",
      header: "Key",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{row.name}</Text>
          <Text type="code" color="secondary">
            {row.prefix}…
          </Text>
        </Stack>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      render: (row) => <Text type="supporting">{formatDay(row.created_at)}</Text>,
    },
    {
      key: "last_used_at",
      header: "Last used",
      render: (row) => (
        <Text type="supporting" color="secondary">
          {row.last_used_at ? formatDateTime(row.last_used_at) : "Never"}
        </Text>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.revoked_at ? (
          <Badge label="Revoked" variant="neutral" />
        ) : (
          <Badge label="Active" variant="success" />
        ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (row) =>
        row.revoked_at ? null : (
          <Button label="Revoke" variant="ghost" size="sm" clickAction={() => setRevoking(row)} />
        ),
    },
  ];

  return (
    <Stack gap={4}>
      <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
        <Text color="secondary">
          Keys act as you. Keep them on your servers, never in a browser or an app.
        </Text>
        <Button label="Create key" variant="primary" clickAction={() => setCreating(true)} />
      </HStack>
      <Table
        caption="API keys"
        columns={columns}
        rows={keys}
        rowKey={(row) => row.id}
        variant="plain"
        empty={
          <EmptyState
            isCompact
            title="No keys yet"
            description="Create one to submit jobs over the API."
          />
        }
      />

      <Dialog
        isOpen={creating}
        onOpenChange={(open) => (open ? setCreating(true) : close())}
        width={DIALOG_WIDTH}
        purpose="form"
      >
        <Stack gap={5}>
          <DialogHeader
            title={created ? "Copy your key" : "Create an API key"}
            subtitle={created ? created.name : "Name it after the system that will use it."}
            onOpenChange={(open) => (open ? undefined : close())}
          />
          {created ? (
            <Stack gap={4}>
              <Banner
                status="warning"
                title="This is the only time the key is shown"
                description="Store it in your secrets manager now. Lost keys can only be revoked and replaced."
              />
              <CodeBlock
                code={created.secret}
                language="text"
                hasLanguageLabel={false}
                hasCopyButton
                isWrapped
              />
              <HStack hAlign="end">
                <Button label="Done" variant="primary" clickAction={close} />
              </HStack>
            </Stack>
          ) : (
            <Stack gap={4}>
              {error ? <Banner status="error" title={error} /> : null}
              <TextInput
                label="Name"
                value={name}
                onChange={setName}
                placeholder="Sourcing pipeline"
                hasAutoFocus
                onEnter={() => void create()}
              />
              <HStack hAlign="end" gap={2}>
                <Button label="Cancel" variant="ghost" clickAction={close} />
                <Button
                  label="Create key"
                  variant="primary"
                  clickAction={create}
                  isDisabled={!name.trim()}
                />
              </HStack>
            </Stack>
          )}
        </Stack>
      </Dialog>

      <AlertDialog
        isOpen={revoking !== null}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        title={`Revoke ${revoking?.name ?? "key"}?`}
        description="Requests using this key fail right away. Submissions it already made stay yours."
        actionLabel="Revoke key"
        actionVariant="destructive"
        onAction={revoke}
      />
    </Stack>
  );
}
