"use client";

import { useEffect, useState } from "react";
import { RadioList, RadioListItem, Stack, Text, TextInput } from "sid-ui";
import type { CompanyChoice, CompanyOption } from "@/lib/auth/types";

export type HiringPath = "link" | "create";

/** Join a company that invited this account, or start a new company page. */
export function CompanyFields({
  path,
  onPath,
  onChoice,
}: {
  path: HiringPath;
  onPath: (path: HiringPath) => void;
  onChoice: (choice: CompanyChoice | null) => void;
}) {
  const [invites, setInvites] = useState<CompanyOption[] | null>(null);
  const [selectedID, setSelectedID] = useState("");
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/auth/companies", { signal: controller.signal });
        if (!response.ok) {
          setLoadError("Could not load company invites.");
          setInvites([]);
          return;
        }
        const body = (await response.json()) as { companies?: CompanyOption[] };
        setInvites(body.companies ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError("Could not load company invites.");
        setInvites([]);
      }
    })();
    return () => controller.abort();
  }, []);

  const choosePath = (next: HiringPath) => {
    onPath(next);
    if (next === "link") {
      const invited = invites?.find((company) => company.id === selectedID);
      onChoice(invited ? { id: invited.id } : null);
      return;
    }
    onChoice(name.trim() ? { name: name.trim(), url: url.trim() } : null);
  };

  const pending = invites ?? [];

  return (
    <Stack gap={4}>
      <RadioList label="Company" value={path} onChange={(value) => choosePath(value as HiringPath)}>
        <RadioListItem
          value="link"
          label="Join a company that invited you"
          description="An owner must invite your work email before you can join an existing company."
        />
        <RadioListItem
          value="create"
          label="Create a new company"
          description="Required if you don’t have an invite."
        />
      </RadioList>

      {path === "link" ? (
        <Stack gap={2}>
          {invites === null ? <Text color="secondary">Loading invites…</Text> : null}
          {loadError ? <Text color="secondary">{loadError}</Text> : null}
          {invites !== null && pending.length === 0 && !loadError ? (
            <Text color="secondary">
              No invites yet. Ask an owner to invite your work email, or create a new company.
            </Text>
          ) : null}
          {pending.length > 0 ? (
            <RadioList
              label="Invites"
              value={selectedID}
              onChange={(value) => {
                setSelectedID(value);
                onChoice({ id: value });
              }}
            >
              {pending.map((company) => (
                <RadioListItem
                  key={company.id}
                  value={company.id}
                  label={company.name}
                  description={company.url ?? ""}
                />
              ))}
            </RadioList>
          ) : null}
        </Stack>
      ) : (
        <Stack gap={3}>
          <TextInput
            label="Company name"
            value={name}
            onChange={(value) => {
              setName(value);
              onChoice(value.trim() ? { name: value.trim(), url: url.trim() } : null);
            }}
          />
          <TextInput
            label="Website"
            value={url}
            onChange={(value) => {
              setUrl(value);
              onChoice(name.trim() ? { name: name.trim(), url: value.trim() } : null);
            }}
            placeholder="company.com"
            isOptional
          />
        </Stack>
      )}
    </Stack>
  );
}
