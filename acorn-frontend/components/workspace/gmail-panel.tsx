"use client";

import { useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Divider,
  HStack,
  PageHeader,
  SectionCard,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@joined/design-system";
import type { AcornAccount } from "@/lib/auth/session";
import { MAILBOX_LABEL_MAX, isEmail, type Mailbox } from "@/lib/workspace/model";
import { useWorkspace } from "./use-workspace";

const SAMPLE_MAILBOXES: Mailbox[] = [
  {
    id: "sample-personal",
    email: "you@gmail.com",
    label: "Personal",
    isDefault: true,
    watchesApplications: true,
    connectedAt: "2026-09-02",
  },
  {
    id: "sample-work",
    email: "jobs@gmail.com",
    label: "Applications",
    isDefault: false,
    watchesApplications: true,
    connectedAt: "2026-08-14",
  },
];

const SAMPLE_MAIL = [
  {
    id: "mail-1",
    from: "Avery Chen · Northwind",
    subject: "Interview request",
    snippet: "We would like to schedule a conversation about the senior engineer role.",
  },
  {
    id: "mail-2",
    from: "Lumen Recruiting",
    subject: "Application received",
    snippet: "Thanks for applying. A recruiter will reply if there is a match.",
  },
  {
    id: "mail-3",
    from: "Harbor Health",
    subject: "Next step",
    snippet: "Please confirm the salary range and your earliest start date.",
  },
];

export function GmailPanel({ account }: { account: AcornAccount }) {
  const { workspace, update } = useWorkspace();
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  const connect = (address: string, mailboxLabel: string) => {
    const nextEmail = address.trim().toLowerCase();
    if (!isEmail(nextEmail)) {
      setError("Enter a full email address.");
      return;
    }
    if (mailboxes.some((mailbox) => mailbox.email === nextEmail)) {
      setError("That mailbox is already connected.");
      return;
    }
    const mailbox: Mailbox = {
      id: crypto.randomUUID(),
      email: nextEmail,
      label: mailboxLabel.trim() || "Gmail",
      isDefault: mailboxes.length === 0,
      watchesApplications: true,
      connectedAt: new Date().toISOString(),
    };
    update({ ...workspace, mailboxes: [...mailboxes, mailbox] });
    setEmail("");
    setLabel("");
    setError("");
  };

  const patch = (id: string, change: Partial<Mailbox>) => {
    update({
      ...workspace,
      mailboxes: mailboxes.map((mailbox) => {
        if (change.isDefault) return { ...mailbox, isDefault: mailbox.id === id };
        if (mailbox.id !== id) return mailbox;
        return { ...mailbox, ...change };
      }),
    });
  };

  const disconnect = (id: string) => {
    const remaining = mailboxes.filter((mailbox) => mailbox.id !== id);
    if (remaining.length > 0 && !remaining.some((mailbox) => mailbox.isDefault)) {
      remaining[0] = { ...remaining[0], isDefault: true };
    }
    update({ ...workspace, mailboxes: remaining });
  };

  const accountIsGmail = account.email.toLowerCase().endsWith("@gmail.com");
  const mailboxes = workspace.mailboxes.length
    ? workspace.mailboxes
    : SAMPLE_MAILBOXES.map((mailbox, index) =>
        index === 0 ? { ...mailbox, email: account.email } : mailbox,
      );
  const showingSample = workspace.mailboxes.length === 0;

  return (
    <Stack gap={6}>
      <PageHeader
        title="Gmail"
        description="Connect the mailboxes that should receive application replies."
      />
      <SectionCard
        title="Connect a mailbox"
        description="Pick the address that should receive application replies."
      >
        <Stack gap={4}>
          {accountIsGmail ? (
            <HStack gap={3} wrap="wrap" vAlign="center">
              <Text>{account.email}</Text>
              <Button
                label="Connect this Gmail"
                variant="secondary"
                size="sm"
                onClick={() => connect(account.email, "Personal")}
              />
            </HStack>
          ) : null}
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@gmail.com"
            autoComplete="email"
          />
          <TextInput
            label="Label"
            value={label}
            onChange={(value) => setLabel(value.slice(0, MAILBOX_LABEL_MAX))}
            placeholder="Personal"
            isOptional
          />
          {error ? <Banner status="error" title={error} /> : null}
          <Button label="Connect" variant="primary" onClick={() => connect(email, label)} />
        </Stack>
      </SectionCard>
      {showingSample ? (
        <SectionCard title="Inbox" description="Replies waiting on the connected mailboxes.">
          <Stack gap={4}>
            {SAMPLE_MAIL.map((message) => (
              <Stack key={message.id} gap={1}>
                <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                  <Text weight="semibold">{message.subject}</Text>
                  <Badge label="Unread" variant="blue" />
                </HStack>
                <Text color="secondary">{message.from}</Text>
                <Text>{message.snippet}</Text>
              </Stack>
            ))}
          </Stack>
        </SectionCard>
      ) : null}
      <SectionCard title="Connected" description={`${mailboxes.length} connected.`}>
        <Stack gap={5}>
          {mailboxes.map((mailbox, index) => (
            <Stack key={mailbox.id} gap={4}>
              {index > 0 ? <Divider /> : null}
              <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
                <Stack gap={1}>
                  <Text weight="semibold">{mailbox.email}</Text>
                  <Text color="secondary">{mailbox.label}</Text>
                </Stack>
                <HStack gap={2} wrap="wrap">
                  {mailbox.isDefault ? <Badge label="Default" variant="blue" /> : null}
                  {mailbox.watchesApplications ? (
                    <Badge label="Watching replies" variant="success" />
                  ) : null}
                </HStack>
              </HStack>
              <Switch
                label="Default mailbox"
                description="New applications use this address."
                value={mailbox.isDefault}
                onChange={(checked) => {
                  if (checked) patch(mailbox.id, { isDefault: true });
                }}
              />
              <Switch
                label="Watch for replies"
                description="Count recruiter replies toward your statistics."
                value={mailbox.watchesApplications}
                onChange={(checked) => patch(mailbox.id, { watchesApplications: checked })}
              />
              <Button
                label="Disconnect"
                variant="secondary"
                size="sm"
                onClick={() => disconnect(mailbox.id)}
              />
            </Stack>
          ))}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
