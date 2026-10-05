"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Divider,
  Drawer,
  Glyph,
  HStack,
  Heading,
  Stack,
  Switch,
  Text,
  TextInput,
} from "sid-ui";
import { MAILBOX_LABEL_MAX, formatWhen, isEmail, type Mailbox } from "@/lib/workspace/model";

/** Connect, set the default, choose which mailboxes count replies, and disconnect. */
export function MailboxManager({
  isOpen,
  onOpenChange,
  accountEmail,
  mailboxes,
  isSample,
  onChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  accountEmail: string;
  mailboxes: Mailbox[];
  /** The list is the starter pair, not something the person saved. */
  isSample: boolean;
  onChange: (mailboxes: Mailbox[]) => void;
}) {
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const saved = isSample ? [] : mailboxes;

  const connect = (address: string, mailboxLabel: string) => {
    const nextEmail = address.trim().toLowerCase();
    if (!isEmail(nextEmail)) {
      setError("Enter a full email address.");
      return;
    }
    if (saved.some((mailbox) => mailbox.email === nextEmail)) {
      setError("That mailbox is already connected.");
      return;
    }
    onChange([
      ...saved,
      {
        id: crypto.randomUUID(),
        email: nextEmail,
        label: mailboxLabel.trim() || "Gmail",
        isDefault: saved.length === 0,
        watchesApplications: true,
        connectedAt: new Date().toISOString(),
      },
    ]);
    setEmail("");
    setLabel("");
    setError("");
  };

  const patch = (id: string, change: Partial<Mailbox>) => {
    onChange(
      mailboxes.map((mailbox) => {
        if (change.isDefault) return { ...mailbox, isDefault: mailbox.id === id };
        return mailbox.id === id ? { ...mailbox, ...change } : mailbox;
      }),
    );
  };

  const disconnect = (id: string) => {
    const remaining = mailboxes.filter((mailbox) => mailbox.id !== id);
    if (remaining.length > 0 && !remaining.some((mailbox) => mailbox.isDefault)) {
      remaining[0] = { ...remaining[0], isDefault: true };
    }
    onChange(remaining);
  };

  const accountIsGmail = accountEmail.toLowerCase().endsWith("@gmail.com");
  const accountConnected = saved.some((mailbox) => mailbox.email === accountEmail.toLowerCase());

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Mailboxes"
      subtitle="Where application replies arrive"
      size="md"
    >
      <Stack gap={6}>
        {isSample ? (
          <Banner
            status="info"
            title="Starter mailboxes"
            description="Connect your own address below and these placeholders go away."
          />
        ) : null}
        <Stack gap={4}>
          <Heading level={3}>Connect a mailbox</Heading>
          {accountIsGmail && !accountConnected ? (
            <HStack gap={3} wrap="wrap" vAlign="center" hAlign="between">
              <Text>{accountEmail}</Text>
              <Button
                label="Connect this Gmail"
                variant="secondary"
                size="sm"
                onClick={() => connect(accountEmail, "Personal")}
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
            placeholder="Applications"
            isOptional
          />
          {error ? <Banner status="error" title={error} /> : null}
          <HStack>
            <Button
              label="Connect"
              variant="primary"
              icon={<Glyph name="plus" />}
              onClick={() => connect(email, label)}
            />
          </HStack>
        </Stack>
        <Divider />
        <Stack gap={5}>
          <Heading level={3}>{`Connected · ${mailboxes.length}`}</Heading>
          {mailboxes.map((mailbox, index) => (
            <Stack key={mailbox.id} gap={4}>
              {index > 0 ? <Divider /> : null}
              <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
                <HStack gap={3} vAlign="center">
                  <Avatar name={mailbox.email} size={36} />
                  <Stack gap={0}>
                    <Text weight="semibold">{mailbox.email}</Text>
                    <Text type="supporting" color="secondary">
                      {mailbox.label}
                      {formatWhen(mailbox.connectedAt)
                        ? ` · since ${formatWhen(mailbox.connectedAt)}`
                        : ""}
                    </Text>
                  </Stack>
                </HStack>
                <HStack gap={2} wrap="wrap">
                  {mailbox.isDefault ? <Badge label="Default" variant="blue" /> : null}
                  {mailbox.watchesApplications ? (
                    <Badge label="Watching" variant="success" />
                  ) : null}
                </HStack>
              </HStack>
              {isSample ? null : (
                <>
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
                  <HStack>
                    <Button
                      label="Disconnect"
                      variant="secondary"
                      size="sm"
                      icon={<Glyph name="trash" />}
                      onClick={() => disconnect(mailbox.id)}
                    />
                  </HStack>
                </>
              )}
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Drawer>
  );
}
