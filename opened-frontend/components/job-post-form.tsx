"use client";

import { useState } from "react";
import { Banner, Button, FormLayout, Selector, Stack, TextArea, TextInput } from "@openseat/design-system";

const FORM_WIDTH = 560;

const WORKPLACES = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const SENIORITY = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
];

const POLICIES = [
  { value: "accept", label: "Accept assisted applications" },
  { value: "cap", label: "Cap assisted applications per day" },
  { value: "direct", label: "Direct applications only" },
];

export function JobPostForm() {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [summary, setSummary] = useState("");
  const [workplace, setWorkplace] = useState("remote");
  const [seniority, setSeniority] = useState("mid");
  const [policy, setPolicy] = useState("accept");
  const [saved, setSaved] = useState(false);

  return (
    <Stack gap={4} maxWidth={FORM_WIDTH}>
      {saved ? (
        <Banner status="success" title="Draft saved on this page" description="Publishing is not connected yet." />
      ) : null}
      <FormLayout>
        <TextInput label="Job title" value={title} onChange={setTitle} isRequired placeholder="Product designer" />
        <TextInput label="Location" value={location} onChange={setLocation} placeholder="Chicago or remote" />
        <Selector label="Workplace" options={WORKPLACES} value={workplace} onChange={setWorkplace} />
        <Selector label="Seniority" options={SENIORITY} value={seniority} onChange={setSeniority} />
        <TextInput label="Pay" value={salary} onChange={setSalary} placeholder="$140k–$170k" description="Shown on the job card. A range is enough." />
        <TextArea label="Summary" value={summary} onChange={setSummary} placeholder="What the person will do in the first month." />
        <Selector label="Assisted applications" options={POLICIES} value={policy} onChange={setPolicy} description="Companies can cap or refuse applications prepared by a bidder or the agent." />
        <Button label="Save draft" variant="primary" onClick={() => setSaved(true)} isDisabled={title.trim().length === 0} />
      </FormLayout>
    </Stack>
  );
}
