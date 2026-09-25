"use client";

import { useEffect, useState } from "react";
import { Button, Card, HStack, Heading, Icon, ProgressBar, Stack, Text, icons, type ProgressBarVariant } from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const VARIANTS: ProgressBarVariant[] = ["accent", "success", "warning", "error", "neutral"];
const UPLOAD_TICK_MS = 120;
const UPLOAD_STEP = 4;
const QUOTA_GB = 10;
const QUOTA_WARN = 0.8;
const QUOTA_FULL = 0.95;
const MILESTONES = [
  { value: 25, label: "Brief" },
  { value: 50, label: "Invites" },
  { value: 75, label: "Bids" },
  { value: 100, label: "Award" },
];
const FILES = [
  { name: "brief.pdf", done: 100 },
  { name: "moodboard.png", done: 64 },
  { name: "budget.xlsx", done: 12 },
];

export default function ProgressBarDemo() {
  const [upload, setUpload] = useState(0);
  const [running, setRunning] = useState(false);
  const [used, setUsed] = useState(6.4);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setUpload((v) => {
        const next = Math.min(100, v + UPLOAD_STEP);
        if (next === 100) setRunning(false);
        return next;
      });
    }, UPLOAD_TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const ratio = used / QUOTA_GB;
  const quotaVariant: ProgressBarVariant = ratio >= QUOTA_FULL ? "error" : ratio >= QUOTA_WARN ? "warning" : "accent";

  return (
    <Examples>
      <Preview label="Values" description="Determinate progress from 0 to max. The label names the task.">
        <Stack gap={3}>
          {[0, 25, 60, 100].map((value) => (
            <ProgressBar key={value} label={`${value}% complete`} value={value} />
          ))}
        </Stack>
      </Preview>

      <Preview label="Variants" description="accent by default; status variants when progress also means health.">
        <Stack gap={3}>
          {VARIANTS.map((variant) => (
            <ProgressBar key={variant} label={variant} value={65} variant={variant} />
          ))}
        </Stack>
      </Preview>

      <Preview label="Value label" description="hasValueLabel shows the number; formatValueLabel writes it your way.">
        <Stack gap={3}>
          <ProgressBar label="Profile" value={70} hasValueLabel />
          <ProgressBar label="Invitees who bid" value={4} max={6} hasValueLabel formatValueLabel={(v, m) => `${v} of ${m}`} />
          <ProgressBar label="Budget used" value={1800} max={2400} hasValueLabel formatValueLabel={(v, m) => `$${v.toLocaleString()} / $${m.toLocaleString()}`} />
        </Stack>
      </Preview>

      <Preview label="Hidden label" description="isLabelHidden keeps the name for screen readers when the context already says it.">
        <HStack gap={3} vAlign="center">
          <Text>Uploading…</Text>
          <Stack width={200}>
            <ProgressBar label="Upload progress" isLabelHidden value={42} />
          </Stack>
        </HStack>
      </Preview>

      <Preview label="Indeterminate" description="When you can’t know how long — then switch to a value as soon as you can.">
        <ProgressBar label="Preparing export" isIndeterminate />
      </Preview>

      <Preview label="Milestones" description="marks label points along the bar — hover a mark for its name.">
        <ProgressBar label="Room setup" value={50} marks={MILESTONES} hasValueLabel />
      </Preview>

      <Preview label="Disabled">
        <ProgressBar label="Sync paused" value={30} isDisabled hasValueLabel />
      </Preview>

      <Preview label="Live upload" description="A simulated upload — the bar turns success when it finishes.">
        <Stack gap={3}>
          <ProgressBar
            label={upload === 100 ? "Uploaded brief.pdf" : "Uploading brief.pdf"}
            value={upload}
            hasValueLabel
            variant={upload === 100 ? "success" : "accent"}
          />
          <HStack gap={2}>
            <Button label={running ? "Uploading…" : upload === 100 ? "Upload again" : "Start upload"} size="sm" variant="primary" isDisabled={running} onClick={() => { setUpload(0); setRunning(true); }} />
            <Button label="Pause" size="sm" variant="ghost" isDisabled={!running} onClick={() => setRunning(false)} />
          </HStack>
        </Stack>
      </Preview>

      <Preview label="Storage quota" description="The variant changes at thresholds — accent, then warning at 80%, error at 95%.">
        <Card maxWidth={420}>
          <Stack gap={3}>
            <HStack hAlign="between" vAlign="center">
              <HStack gap={2} vAlign="center">
                <Icon icon={icons.folder} color="secondary" />
                <Heading level={4}>Storage</Heading>
              </HStack>
              <Text type="supporting" color="secondary" hasTabularNumbers>
                {used.toFixed(1)} of {QUOTA_GB} GB
              </Text>
            </HStack>
            <ProgressBar label="Storage used" isLabelHidden value={used} max={QUOTA_GB} variant={quotaVariant} />
            <HStack gap={2}>
              <Button label="Add 1 GB" size="sm" onClick={() => setUsed((u) => Math.min(QUOTA_GB, u + 1))} />
              <Button label="Clean up" size="sm" variant="ghost" onClick={() => setUsed(2.1)} />
            </HStack>
          </Stack>
        </Card>
      </Preview>

      <Preview label="Attachment list" description="One bar per file, status in the variant.">
        <Stack gap={3}>
          {FILES.map((file) => (
            <Stack key={file.name} gap={1}>
              <HStack hAlign="between">
                <Text>{file.name}</Text>
                <Caption>{file.done === 100 ? "Done" : `${file.done}%`}</Caption>
              </HStack>
              <ProgressBar label={file.name} isLabelHidden value={file.done} variant={file.done === 100 ? "success" : "accent"} />
            </Stack>
          ))}
        </Stack>
      </Preview>
    </Examples>
  );
}
