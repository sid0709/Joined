"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, Card, Heading, Stack, Text } from "@openseat/design-system";
import type { CompanyChoice } from "@/lib/auth/types";
import { writeStoredWorkspaceMode } from "@/lib/workspace-preference";
import { ROUTES } from "@/lib/routes";
import { CompanyFields, type HiringPath } from "./company-fields";

/** After an individual account exists: join a stored company or create the company page. */
export function HiringSetupForm() {
  const router = useRouter();
  const [path, setPath] = useState<HiringPath>("link");
  const [company, setCompany] = useState<CompanyChoice | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const onChoice = useCallback((choice: CompanyChoice | null) => setCompany(choice), []);

  const submit = async () => {
    if (!company) {
      setError(path === "link" ? "Choose a company to link." : "Enter the company name.");
      return;
    }
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(company),
    });
    setPending(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not save the company");
      return;
    }
    writeStoredWorkspaceMode("company");
    router.push(ROUTES.company);
    router.refresh();
  };

  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Heading level={1}>Set up hiring</Heading>
          <Text color="secondary">
            Your account stays personal. Link a company already on Opened, or create the company
            page.
          </Text>
        </Stack>
        {error ? <Banner status="error" title={error} /> : null}
        <CompanyFields path={path} onPath={setPath} onChoice={onChoice} />
        <Button label="Continue" variant="primary" clickAction={submit} isDisabled={pending} />
      </Stack>
    </Card>
  );
}
