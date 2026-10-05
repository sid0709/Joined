"use client";

import {
  Avatar,
  Badge,
  Button,
  Divider,
  Drawer,
  Glyph,
  HStack,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
} from "sid-ui";
import { ROUTES } from "@/lib/routes";
import { formatClock, formatDay } from "@/lib/workspace/dates";
import { MAIL_LABELS, type MailMessage } from "@/lib/workspace/mail";

/** One message, opened from the inbox. */
export function MailReader({
  message,
  mailbox,
  onClose,
  onMarkUnread,
}: {
  message: MailMessage | null;
  mailbox: string;
  onClose: () => void;
  onMarkUnread: (id: string) => void;
}) {
  if (!message) return null;
  const label = MAIL_LABELS[message.label];
  return (
    <Drawer
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={message.subject}
      subtitle={`${message.sender} · ${formatDay(message.receivedOn)}, ${formatClock(message.receivedAt)}`}
      headerStart={<Avatar name={message.sender} size={40} />}
      size="lg"
      footer={
        <HStack gap={2} hAlign="between" wrap="wrap">
          <Button
            label="Mark unread"
            variant="secondary"
            icon={<Glyph name="dot" />}
            onClick={() => {
              onMarkUnread(message.id);
              onClose();
            }}
          />
          <HStack gap={2} wrap="wrap">
            <Button label="See statistics" variant="ghost" href={ROUTES.overview} />
            <Button label="Done" variant="primary" onClick={onClose} />
          </HStack>
        </HStack>
      }
    >
      <Stack gap={5}>
        <MetadataList columns={2}>
          <MetadataListItem label="From">
            {message.sender} &lt;{message.senderEmail}&gt;
          </MetadataListItem>
          <MetadataListItem label="To">{mailbox}</MetadataListItem>
          <MetadataListItem label="Application">
            {message.role} · {message.company}
          </MetadataListItem>
          <MetadataListItem label="Label">
            <Badge label={label.label} variant={label.badge} icon={<Glyph name={label.icon} />} />
          </MetadataListItem>
        </MetadataList>
        <Divider />
        <Stack gap={3}>
          {message.body.map((paragraph) => (
            <Text key={paragraph}>{paragraph}</Text>
          ))}
        </Stack>
      </Stack>
    </Drawer>
  );
}
