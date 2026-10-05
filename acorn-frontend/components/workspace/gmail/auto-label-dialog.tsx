"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogHeader,
  Glyph,
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  ProgressBar,
  SegmentedControl,
  SegmentedControlItem,
  Selector,
  Stack,
  Text,
  TextInput,
} from "sid-ui";
import {
  DEFAULT_PARENT_LABEL,
  LABEL_NAME_MAX,
  NO_LABEL,
  createdMap,
  labelCounts,
  suggestMap,
  type LabelMap,
  type LabelMode,
  type Labeling,
} from "@/lib/workspace/labels";
import {
  MAIL_LABELS,
  MAIL_LABEL_ORDER,
  countByLabel,
  type MailMessage,
} from "@/lib/workspace/mail";

const DIALOG_WIDTH = 600;
const RUN_TICK_MS = 60;
const RUN_STEP = 8;
const DONE = 100;

/** Choose your labels or let Acorn make them, then label every application message. */
export function AutoLabelDialog({
  isOpen,
  onOpenChange,
  mail,
  gmailLabels,
  labeling,
  onAddLabel,
  onApply,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mail: MailMessage[];
  gmailLabels: string[];
  labeling: Labeling | null;
  onAddLabel: (name: string) => void;
  onApply: (labeling: Labeling) => void;
}) {
  const [mode, setMode] = useState<LabelMode>(labeling?.mode ?? "existing");
  const [map, setMap] = useState<LabelMap>(
    labeling?.mode === "existing" ? labeling.map : suggestMap(gmailLabels),
  );
  const [parent, setParent] = useState(DEFAULT_PARENT_LABEL);
  const [newLabel, setNewLabel] = useState("");
  const [progress, setProgress] = useState<number | null>(null);

  const chosen = mode === "existing" ? map : createdMap(parent);
  const counts = countByLabel(mail);
  const planned = labelCounts(mail, chosen);
  const total = planned.reduce((sum, item) => sum + item.count, 0);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  /** Steps the bar, then hands the finished labeling back and closes. */
  const run = () => {
    const result: Labeling = { mode, map: chosen, appliedAt: new Date().toISOString() };
    let value = 0;
    setProgress(0);
    timer.current = setInterval(() => {
      value = Math.min(DONE, value + RUN_STEP);
      setProgress(value);
      if (value < DONE) return;
      if (timer.current) clearInterval(timer.current);
      setProgress(null);
      onApply(result);
      onOpenChange(false);
    }, RUN_TICK_MS);
  };

  const addLabel = () => {
    const name = newLabel.trim().slice(0, LABEL_NAME_MAX);
    if (!name || gmailLabels.includes(name)) return;
    onAddLabel(name);
    setNewLabel("");
  };

  const options = [
    { value: NO_LABEL, label: "Don't label" },
    ...gmailLabels.map((label) => ({ value: label, label })),
  ];
  const running = progress !== null;

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={DIALOG_WIDTH}>
      <Layout
        height="auto"
        header={
          <DialogHeader
            title="Auto-label application mail"
            subtitle={`${mail.length} messages sorted into ${MAIL_LABEL_ORDER.length} categories`}
            onOpenChange={onOpenChange}
            hasDivider
          />
        }
        content={
          <LayoutContent>
            <Stack gap={5}>
              <SegmentedControl
                label="Label source"
                value={mode}
                onChange={(value) => setMode(value as LabelMode)}
                layout="fill"
                isDisabled={running}
              >
                <SegmentedControlItem value="existing" label="Use my Gmail labels" />
                <SegmentedControlItem value="create" label="Create labels for me" />
              </SegmentedControl>
              {mode === "existing" ? (
                <Stack gap={4}>
                  <Text type="supporting" color="secondary">
                    Pick one of your labels for each kind of message. We suggested matches by name.
                  </Text>
                  {MAIL_LABEL_ORDER.map((category) => (
                    <HStack key={category} gap={3} vAlign="center" hAlign="between" wrap="wrap">
                      <HStack gap={2} vAlign="center">
                        <Glyph name={MAIL_LABELS[category].icon} />
                        <Text weight="semibold">{MAIL_LABELS[category].label}</Text>
                        <Badge label={String(counts[category])} variant="neutral" />
                      </HStack>
                      <Selector
                        label={`Gmail label for ${MAIL_LABELS[category].label}`}
                        isLabelHidden
                        options={options}
                        value={map[category] ?? NO_LABEL}
                        onChange={(value) => setMap({ ...map, [category]: value || null })}
                        isDisabled={running}
                      />
                    </HStack>
                  ))}
                  <HStack gap={2} vAlign="end">
                    <TextInput
                      label="Add a Gmail label"
                      value={newLabel}
                      onChange={(value) => setNewLabel(value.slice(0, LABEL_NAME_MAX))}
                      placeholder="Hiring managers"
                      isDisabled={running}
                    />
                    <Button
                      label="Add"
                      variant="secondary"
                      icon={<Glyph name="plus" />}
                      onClick={addLabel}
                      isDisabled={running || !newLabel.trim()}
                    />
                  </HStack>
                </Stack>
              ) : (
                <Stack gap={4}>
                  <TextInput
                    label="Parent label"
                    value={parent}
                    onChange={(value) => setParent(value.slice(0, LABEL_NAME_MAX))}
                    description="Acorn creates one nested label per category under it."
                    isDisabled={running}
                  />
                  <HStack gap={2} wrap="wrap">
                    {MAIL_LABEL_ORDER.map((category) => (
                      <Badge
                        key={category}
                        label={`${chosen[category]} · ${counts[category]}`}
                        variant={MAIL_LABELS[category].badge}
                        icon={<Glyph name="tag" />}
                      />
                    ))}
                  </HStack>
                </Stack>
              )}
              {running ? (
                <ProgressBar label="Labeling messages" value={progress ?? 0} hasValueLabel />
              ) : null}
            </Stack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
              <Text type="supporting" color="secondary">
                {total === 0
                  ? "Choose at least one label."
                  : `${total} messages get ${planned.length} labels`}
              </Text>
              <HStack gap={2}>
                <Button
                  label="Cancel"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  isDisabled={running}
                />
                <Button
                  label={running ? "Labeling…" : "Apply labels"}
                  variant="primary"
                  icon={<Glyph name="tag" />}
                  onClick={run}
                  isLoading={running}
                  isDisabled={running || total === 0}
                />
              </HStack>
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
