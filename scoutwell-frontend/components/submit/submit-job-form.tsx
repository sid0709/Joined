"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  FormLayout,
  HStack,
  Selector,
  Stack,
  Text,
  TextArea,
  TextInput,
  useToast,
} from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { SENIORITY_OPTIONS, SUMMARY_MIN_CHARS } from "@/lib/config";
import { parseTags } from "@/lib/format";
import { levelMetrics } from "@/lib/levels";
import { precheckUrl } from "@/lib/precheck";
import { ROUTES } from "@/lib/routes";
import { useScout } from "@/lib/scout-store";
import { ownedBy } from "@/lib/stats";
import type { Seniority } from "@/lib/config";
import { CheckOutcomeBadge } from "@/components/status-badge";
import { evaluateSubmission } from "@/lib/pipeline";

export function SubmitJobForm() {
  const router = useRouter();
  const toast = useToast();
  const scout = useScout();
  const user = scout.user;
  const [url, setUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  const [locationText, setLocationText] = useState("");
  const [salaryText, setSalaryText] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");
  const [seniority, setSeniority] = useState<Seniority>("mid");
  const [error, setError] = useState("");

  const mine = useMemo(
    () => (user ? ownedBy(scout.state.submissions, user.id) : []),
    [scout.state.submissions, user],
  );
  const metrics = user ? levelMetrics(user, mine) : null;
  const preview = useMemo(() => precheckUrl(url, mine), [mine, url]);
  const liveChecks = useMemo(
    () =>
      user && url
        ? evaluateSubmission({ url, companyName, title, summary }, user, mine).autoCheckResults
        : [],
    [companyName, mine, summary, title, url, user],
  );

  if (!user || !metrics) return null;

  const submit = () => {
    const result = scout.submitJob({
      url,
      companyName,
      title,
      locationText,
      salaryText,
      summary,
      tags: parseTags(tags),
      seniority,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const created = result.state.submissions.find((item) => item.scoutUserId === user.id);
    toast({ body: "Submission sent through quality checks." });
    if (created) router.push(ROUTES.submission(created.id));
    else router.push(ROUTES.submissions);
  };

  return (
    <Stack gap={6}>
      <PageHeader
        title="Submit a job"
        description={`${metrics.remainingToday} of ${metrics.dailyLimit} submissions left today. Official apply URL required.`}
      />
      {error ? <Banner status="error" title={error} /> : null}
      {preview.jobBoard ? (
        <Banner
          status="error"
          title="Not an official source"
          description="That host is another job board."
        />
      ) : null}
      {preview.duplicateOf ? (
        <Banner
          status="warning"
          title="Already in the pool"
          description="The first approved submission owns this job."
        />
      ) : null}
      {url && preview.official && !preview.duplicateOf ? (
        <Banner status="success" title={preview.reason} description={preview.host} />
      ) : null}
      <SectionCard title="Official listing">
        <FormLayout>
          <TextInput
            label="Apply URL"
            value={url}
            onChange={setUrl}
            isRequired
            placeholder="https://boards.greenhouse.io/acme/jobs/123"
            description="Company domain or a known ATS. Not LinkedIn or Indeed."
          />
          <TextInput label="Company" value={companyName} onChange={setCompanyName} isRequired />
          <TextInput label="Title" value={title} onChange={setTitle} isRequired />
          <TextInput
            label="Location"
            value={locationText}
            onChange={setLocationText}
            placeholder="Remote (US)"
          />
          <TextInput
            label="Salary if known"
            value={salaryText}
            onChange={setSalaryText}
            isOptional
          />
          <Selector
            label="Seniority"
            options={SENIORITY_OPTIONS}
            value={seniority}
            onChange={(value) => setSeniority(value as Seniority)}
          />
          <TextArea
            label="Summary"
            value={summary}
            onChange={setSummary}
            isRequired
            description={`Your own words, at least ${SUMMARY_MIN_CHARS} characters. Do not paste the full description.`}
          />
          <TextInput
            label="Tags"
            value={tags}
            onChange={setTags}
            isOptional
            placeholder="remote, visa, hidden"
            description="Comma-separated."
          />
        </FormLayout>
      </SectionCard>
      {liveChecks.length > 0 ? (
        <SectionCard title="Live checks">
          <Stack gap={3}>
            {liveChecks.map((check) => (
              <Stack key={check.id} gap={1}>
                <HStack gap={2} vAlign="center">
                  <Text weight="medium">{check.label}</Text>
                  <CheckOutcomeBadge outcome={check.outcome} />
                </HStack>
                <Text type="supporting" color="secondary" display="block">
                  {check.detail}
                </Text>
              </Stack>
            ))}
          </Stack>
        </SectionCard>
      ) : null}
      <Button
        label="Submit job"
        variant="primary"
        clickAction={submit}
        isDisabled={
          !url.trim() ||
          !companyName.trim() ||
          !title.trim() ||
          summary.trim().length < SUMMARY_MIN_CHARS
        }
      />
    </Stack>
  );
}
