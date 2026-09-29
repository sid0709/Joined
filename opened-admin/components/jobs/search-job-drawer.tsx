"use client";

import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  CodeBlock,
  Collapsible,
  Drawer,
  GridColumn,
  GridSystem,
  HStack,
  MetadataList,
  MetadataListItem,
  NumberInput,
  Selector,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextArea,
  TextInput,
} from "@openseat/design-system";
import {
  EMPLOYMENT_OPTIONS,
  PAY_PERIOD_OPTIONS,
  SENIORITY_OPTIONS,
  WORKPLACE_OPTIONS,
} from "@openseat/job-schema";
import { ListField } from "@/components/list-field";
import { adminFetch, adminSend } from "@/lib/api";
import { formatCount } from "@/lib/format";
import {
  SEARCH_JOBS_PATH,
  searchJobPatchFrom,
  type SearchJobPatch,
  type SearchRecord,
} from "@/lib/search-job";

const DRAWER_SIZE = "lg";
const LOADING_HEIGHT = 160;
const RAW_MAX_HEIGHT = 320;

/** Edit a public job. Every field is sent on save, as the API expects. */
export function SearchJobDrawer({
  jobId,
  onClose,
  onSaved,
}: {
  jobId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  return <SearchJobDetail key={jobId} jobId={jobId} onClose={onClose} onSaved={onSaved} />;
}

function SearchJobDetail({
  jobId,
  onClose,
  onSaved,
}: {
  jobId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [record, setRecord] = useState<SearchRecord | null>(null);
  const [draft, setDraft] = useState<SearchJobPatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const path = `${SEARCH_JOBS_PATH}/${encodeURIComponent(jobId)}`;

  useEffect(() => {
    const controller = new AbortController();
    adminFetch<SearchRecord>(path, { signal: controller.signal })
      .then((body) => {
        if (controller.signal.aborted) return;
        setRecord(body);
        setDraft(searchJobPatchFrom(body));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load job");
        }
      });
    return () => controller.abort();
  }, [path]);

  const set =
    <K extends keyof SearchJobPatch>(key: K) =>
    (value: SearchJobPatch[K]) => {
      setSaved(false);
      setDraft((current) => (current ? { ...current, [key]: value } : current));
    };
  const setPay =
    <K extends keyof SearchJobPatch["pay"]>(key: K) =>
    (value: SearchJobPatch["pay"][K]) => {
      setSaved(false);
      setDraft((current) =>
        current ? { ...current, pay: { ...current.pay, [key]: value } } : current,
      );
    };

  async function save() {
    if (!draft) return;
    setSaveError(null);
    try {
      const updated = await adminSend<SearchRecord>(path, "PATCH", draft);
      setRecord(updated);
      setDraft(searchJobPatchFrom(updated));
      setResetToken((token) => token + 1);
      setSaved(true);
      onSaved?.();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Could not save job");
    }
  }

  return (
    <Drawer
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={draft?.title || (error ? "Job" : "Loading job")}
      subtitle={
        record ? `${record.job.company} · ${record.source || record.job.source}` : "Public job"
      }
      size={DRAWER_SIZE}
      purpose="form"
      footer={
        <HStack gap={2} hAlign="end">
          <Button label="Close" variant="ghost" clickAction={onClose} />
          <Button label="Save job" variant="primary" clickAction={save} isDisabled={!draft} />
        </HStack>
      }
    >
      <Stack gap={5}>
        {error ? <Banner status="error" title={error} /> : null}
        {saveError ? <Banner status="error" title={saveError} /> : null}
        {saved ? (
          <Banner status="success" title="Job saved" description="Opened shows the change now." />
        ) : null}
        {!draft && !error ? <Skeleton width="100%" height={LOADING_HEIGHT} /> : null}
        {draft && record ? (
          <Stack gap={5}>
            <MetadataList columns={2}>
              <MetadataListItem label="Source">
                {record.source || record.job.source}
              </MetadataListItem>
              <MetadataListItem label="Created by">{record.createdBy || "—"}</MetadataListItem>
              <MetadataListItem label="Model">{record.model || "—"}</MetadataListItem>
              <MetadataListItem label="Posted">
                {formatCount(record.job.postedHoursAgo)}h ago
              </MetadataListItem>
            </MetadataList>
            <GridSystem gap={4}>
              <GridColumn span="full">
                <TextInput label="Title" value={draft.title} onChange={set("title")} />
              </GridColumn>
              <GridColumn span="full" md={6}>
                <TextInput label="Company" value={draft.company} onChange={set("company")} />
              </GridColumn>
              <GridColumn span="full" md={6}>
                <TextInput label="Team" value={draft.team} onChange={set("team")} isOptional />
              </GridColumn>
              <GridColumn span="full" md={6}>
                <TextInput label="Location" value={draft.location} onChange={set("location")} />
              </GridColumn>
              <GridColumn span="full" md={6}>
                <TextInput label="Apply link" value={draft.applyLink} onChange={set("applyLink")} />
              </GridColumn>
              <GridColumn span="full" md={4}>
                <Selector
                  label="Workplace"
                  options={WORKPLACE_OPTIONS}
                  value={draft.workplace}
                  onChange={(value) => set("workplace")(value as SearchJobPatch["workplace"])}
                />
              </GridColumn>
              <GridColumn span="full" md={4}>
                <Selector
                  label="Level"
                  options={SENIORITY_OPTIONS}
                  value={draft.seniority}
                  onChange={(value) => set("seniority")(value as SearchJobPatch["seniority"])}
                />
              </GridColumn>
              <GridColumn span="full" md={4}>
                <Selector
                  label="Employment"
                  options={EMPLOYMENT_OPTIONS}
                  value={draft.employment}
                  onChange={(value) => set("employment")(value as SearchJobPatch["employment"])}
                />
              </GridColumn>
              <GridColumn span="full" md={3}>
                <NumberInput label="Pay min" value={draft.pay.min} onChange={setPay("min")} />
              </GridColumn>
              <GridColumn span="full" md={3}>
                <NumberInput label="Pay max" value={draft.pay.max} onChange={setPay("max")} />
              </GridColumn>
              <GridColumn span="full" md={3}>
                <TextInput
                  label="Currency"
                  value={draft.pay.currency}
                  onChange={(value) => setPay("currency")(value.toUpperCase().slice(0, 3))}
                />
              </GridColumn>
              <GridColumn span="full" md={3}>
                <Selector
                  label="Period"
                  options={PAY_PERIOD_OPTIONS}
                  value={draft.pay.period}
                  onChange={(value) => setPay("period")(value as SearchJobPatch["pay"]["period"])}
                />
              </GridColumn>
            </GridSystem>
            {draft.pay.min === 0 && draft.pay.max === 0 ? (
              <Text type="supporting" color="secondary" display="block">
                Pay not listed. Leave 0 unless the posting gives a real number.
              </Text>
            ) : null}
            <Switch label="Sponsors visas" value={draft.visa} onChange={set("visa")} />
            <TextArea label="Summary" value={draft.summary} onChange={set("summary")} />
            <ListField
              key={`skills-${resetToken}`}
              label="Skills"
              value={draft.skills}
              onChange={set("skills")}
              placeholder="Go"
            />
            <ListField
              key={`responsibilities-${resetToken}`}
              label="Responsibilities"
              value={draft.responsibilities}
              onChange={set("responsibilities")}
              placeholder="Own the deploy pipeline"
            />
            <ListField
              key={`requirements-${resetToken}`}
              label="Requirements"
              value={draft.requirements}
              onChange={set("requirements")}
              placeholder="5+ years with Go"
            />
            <ListField
              key={`benefits-${resetToken}`}
              label="Benefits"
              value={draft.benefits}
              onChange={set("benefits")}
              placeholder="Health insurance"
            />
            <Collapsible trigger="Raw record">
              <CodeBlock
                code={JSON.stringify(record.job, null, 2)}
                language="json"
                maxHeight={RAW_MAX_HEIGHT}
              />
            </Collapsible>
          </Stack>
        ) : null}
      </Stack>
    </Drawer>
  );
}
