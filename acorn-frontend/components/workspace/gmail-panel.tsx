"use client";

import { useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  DonutChart,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  Heading,
  MessageList,
  PageHeader,
  SectionCard,
  Selector,
  Show,
  Stack,
  StatGrid,
  TextInput,
  TrendChart,
  type MessageListItem,
} from "sid-ui";
import type { AcornAccount } from "@/lib/auth/session";
import { formatReceived, type Day } from "@/lib/workspace/dates";
import {
  MAIL_LABELS,
  MAIL_LABEL_ORDER,
  REPLY_LABELS,
  countByLabel,
  isUnread,
  recentFrom,
  repliesByWeek,
  type MailMessage,
} from "@/lib/workspace/mail";
import {
  SAMPLE_GMAIL_LABELS,
  gmailLabelOf,
  labelCounts,
  type Labeling,
} from "@/lib/workspace/labels";
import { formatWhen, type Mailbox } from "@/lib/workspace/model";
import { AutoLabelDialog } from "./gmail/auto-label-dialog";
import { MailReader } from "./gmail/mail-reader";
import { MailboxManager } from "./gmail/mailbox-manager";
import { MailboxSidebar, type MailView } from "./gmail/mailbox-sidebar";
import { useWorkspace } from "./use-workspace";

const SEARCH_MAX = 80;
const RECENT_DAYS = 30;

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

const VIEW_OPTIONS = [
  { value: "inbox", label: "Inbox" },
  { value: "unread", label: "Unread" },
  ...MAIL_LABEL_ORDER.map((label) => ({ value: label, label: MAIL_LABELS[label].label })),
];

function viewTitle(view: MailView) {
  return VIEW_OPTIONS.find((option) => option.value === view)?.label ?? "Inbox";
}

function matches(message: MailMessage, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [message.sender, message.subject, message.snippet, message.company, message.role].some(
    (field) => field.toLowerCase().includes(needle),
  );
}

export function GmailPanel({
  account,
  mail,
  today,
}: {
  account: AcornAccount;
  mail: MailMessage[];
  today: Day;
}) {
  const { workspace, update } = useWorkspace();
  const [view, setView] = useState<MailView>("inbox");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [labelingOpen, setLabelingOpen] = useState(false);
  const [justLabeled, setJustLabeled] = useState<{ total: number; summary: string } | null>(null);

  const isSample = workspace.mailboxes.length === 0;
  const mailboxes = isSample
    ? SAMPLE_MAILBOXES.map((mailbox, index) =>
        index === 0 ? { ...mailbox, email: account.email } : mailbox,
      )
    : workspace.mailboxes;
  const inboxAddress =
    (mailboxes.find((mailbox) => mailbox.isDefault) ?? mailboxes[0])?.email ?? account.email;

  const read = workspace.readMail;
  const labeling = workspace.labeling;
  const gmailLabels = workspace.gmailLabels.length ? workspace.gmailLabels : SAMPLE_GMAIL_LABELS;
  const unreadOf = (message: MailMessage) => isUnread(message, today, read);
  const unreadCount = mail.filter(unreadOf).length;
  const totals = countByLabel(mail);

  const visible = mail.filter((message) => {
    if (view === "unread" && !unreadOf(message)) return false;
    if (view !== "inbox" && view !== "unread" && message.label !== view) return false;
    return matches(message, query);
  });
  const toItem = (message: MailMessage): MessageListItem => ({
    id: message.id,
    sender: message.sender,
    subject: message.subject,
    snippet: message.snippet,
    time: formatReceived(message.receivedOn, message.receivedAt, today),
    isUnread: unreadOf(message),
    tag: gmailLabelOf(message, labeling)
      ? {
          label: gmailLabelOf(message, labeling) as string,
          variant: MAIL_LABELS[message.label].badge,
        }
      : undefined,
  });
  const unreadItems = visible.filter(unreadOf).map(toItem);
  const readItems = visible.filter((message) => !unreadOf(message)).map(toItem);

  const open = (id: string) => {
    setOpenId(id);
    if (!read.includes(id)) update({ ...workspace, readMail: [...read, id] });
  };
  const markUnread = (id: string) => {
    update({ ...workspace, readMail: read.filter((entry) => entry !== id) });
  };
  const markAllRead = () => {
    update({
      ...workspace,
      readMail: Array.from(new Set([...read, ...mail.map((message) => message.id)])),
    });
  };

  const since = recentFrom(today, RECENT_DAYS);
  const recent = mail.filter((message) => message.receivedOn >= since);
  const recentCount = (label: MailMessage["label"]) =>
    recent.filter((message) => message.label === label).length;
  const replies = repliesByWeek(mail, today);
  const opened = mail.find((message) => message.id === openId) ?? null;

  const applyLabels = (next: Labeling) => {
    update({ ...workspace, labeling: next, gmailLabels });
    const counts = labelCounts(mail, next.map);
    setJustLabeled({
      total: counts.reduce((sum, item) => sum + item.count, 0),
      summary: counts.map((item) => `${item.label} (${item.count})`).join(" · "),
    });
  };

  return (
    <Stack gap={6}>
      <PageHeader
        title="Gmail"
        description="Replies to your applications, sorted by what they ask of you."
        action={
          <HStack gap={2} vAlign="center" wrap="wrap">
            {labeling ? (
              <Badge
                label={`Labeled ${formatWhen(labeling.appliedAt)}`}
                variant="success"
                icon={<Glyph name="check" />}
              />
            ) : null}
            <Button
              label="Auto-label"
              variant="primary"
              icon={<Glyph name="tag" />}
              onClick={() => setLabelingOpen(true)}
            />
            <Button
              label="Mailboxes"
              variant="secondary"
              icon={<Glyph name="settings" />}
              onClick={() => setManaging(true)}
            />
          </HStack>
        }
      />
      <Banner
        status="info"
        title="Sample inbox"
        description="Acorn doesn't read Gmail yet. These messages are built from your sample applications, so the labels and counts line up with Statistics."
      />
      {justLabeled ? (
        <Banner
          status="success"
          title={`Labeled ${justLabeled.total} messages`}
          description={justLabeled.summary}
          isDismissable
          onDismiss={() => setJustLabeled(null)}
        />
      ) : null}
      {labeling ? null : (
        <Banner
          status="warning"
          title={`${mail.length} messages aren't labeled in Gmail yet`}
          description="Use your own Gmail labels or let Acorn create a set, then label everything in one go."
          endContent={
            <Button
              label="Auto-label"
              variant="secondary"
              size="sm"
              icon={<Glyph name="tag" />}
              onClick={() => setLabelingOpen(true)}
            />
          }
        />
      )}
      <StatGrid
        stats={[
          { label: "Unread", value: String(unreadCount), hint: "From the last few days" },
          {
            label: "Interview requests",
            value: String(recentCount("interview")),
            hint: "Last 30 days",
          },
          {
            label: "Need a reply",
            value: String(recentCount("next-step")),
            hint: "Salary, start date, availability",
          },
          {
            label: "Offers",
            value: String(totals.offer),
            hint: totals.offer ? "Open the Offer label" : "None yet",
          },
        ]}
      />
      <Card padding={0}>
        <GridSystem gap={0} align="stretch">
          <GridColumn span="full" lg={3}>
            <Show from="lg" responsiveTo="viewport">
              <MailboxSidebar
                name={account.name}
                mailboxes={mailboxes}
                view={view}
                onView={setView}
                totals={totals}
                labelNames={labeling?.map}
                unread={unreadCount}
                onManage={() => setManaging(true)}
              />
            </Show>
          </GridColumn>
          <GridColumn span="full" lg={9}>
            <Stack gap={2} padding={5}>
              <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
                <HStack gap={2} vAlign="center">
                  <Glyph
                    name={view === "inbox" || view === "unread" ? "mail" : MAIL_LABELS[view].icon}
                  />
                  <Heading level={2}>
                    {view !== "inbox" && view !== "unread" && labeling?.map[view]
                      ? labeling.map[view]
                      : viewTitle(view)}
                  </Heading>
                </HStack>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Show below="lg" responsiveTo="viewport">
                    <Selector
                      label="View"
                      isLabelHidden
                      options={VIEW_OPTIONS}
                      value={view}
                      onChange={(value) => setView(value as MailView)}
                    />
                  </Show>
                  <TextInput
                    label="Search mail"
                    isLabelHidden
                    startIcon={<Glyph name="search" />}
                    value={query}
                    onChange={(value) => setQuery(value.slice(0, SEARCH_MAX))}
                    placeholder="Search sender, company, subject"
                  />
                  <Button
                    label="Mark all read"
                    variant="ghost"
                    size="sm"
                    icon={<Glyph name="check" />}
                    onClick={markAllRead}
                    isDisabled={unreadCount === 0}
                  />
                </HStack>
              </HStack>
              {view === "unread" || unreadItems.length > 0 ? (
                <MessageList
                  label="Unread mail"
                  heading="Unread"
                  icon={<Glyph name="mail" />}
                  items={unreadItems}
                  selectedId={openId}
                  onSelect={open}
                  empty={query ? "No unread mail matches." : "You're all caught up."}
                />
              ) : null}
              {view === "unread" ? null : (
                <MessageList
                  label="Read mail"
                  heading="Read"
                  icon={<Glyph name="check" />}
                  items={readItems}
                  selectedId={openId}
                  onSelect={open}
                  empty={query ? "No mail matches." : "Nothing here yet."}
                />
              )}
            </Stack>
          </GridColumn>
        </GridSystem>
      </Card>
      <GridSystem gap={4} align="stretch">
        <GridColumn span="full" lg={8}>
          <SectionCard
            title="Replies per week"
            description="What recruiters and hiring managers sent back."
          >
            <TrendChart
              label="Replies per week by label"
              labels={replies.labels}
              series={replies.series}
              variant="line"
              height={220}
            />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <SectionCard title="What came back" description="Every reply, by label.">
            <DonutChart
              label="Replies by label"
              centerLabel="Replies"
              size={136}
              data={REPLY_LABELS.map((label) => ({
                label: MAIL_LABELS[label].label,
                value: totals[label],
                tone: MAIL_LABELS[label].tone,
              }))}
            />
          </SectionCard>
        </GridColumn>
      </GridSystem>
      <MailReader
        message={opened}
        mailbox={inboxAddress}
        onClose={() => setOpenId(null)}
        onMarkUnread={markUnread}
      />
      <AutoLabelDialog
        isOpen={labelingOpen}
        onOpenChange={setLabelingOpen}
        mail={mail}
        gmailLabels={gmailLabels}
        labeling={labeling}
        onAddLabel={(name) => update({ ...workspace, gmailLabels: [...gmailLabels, name] })}
        onApply={applyLabels}
      />
      <MailboxManager
        isOpen={managing}
        onOpenChange={setManaging}
        accountEmail={account.email}
        mailboxes={mailboxes}
        isSample={isSample}
        onChange={(next) => update({ ...workspace, mailboxes: next })}
      />
    </Stack>
  );
}
