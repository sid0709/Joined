"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  Heading,
  Link,
  RadioList,
  RadioListItem,
  Stack,
  Text,
  TextInput,
} from "@openseat/design-system";
import type { CompanyChoice } from "@/lib/auth/types";
import { writeStoredWorkspaceMode } from "@/lib/workspace-preference";
import { ROUTES } from "@/lib/routes";
import { CompanyFields, type HiringPath } from "./company-fields";

const MIN_PASSWORD = 8;

type AccountMode = "candidate" | "employee";

export function SignUpForm({ nextPath, hiring }: { nextPath: string; hiring: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AccountMode>(hiring ? "employee" : "candidate");
  const [path, setPath] = useState<HiringPath>("link");
  const [company, setCompany] = useState<CompanyChoice | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const onChoice = useCallback((choice: CompanyChoice | null) => setCompany(choice), []);
  const signInHref = `${ROUTES.signIn}?next=${encodeURIComponent(nextPath)}`;

  const submit = async () => {
    if (password.length < MIN_PASSWORD) {
      setError("Use at least 8 characters.");
      return;
    }
    if (mode === "employee" && !company) {
      setError(path === "link" ? "Choose a company to link." : "Enter the company name.");
      return;
    }
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        ...(mode === "employee" && company ? { company } : {}),
      }),
    });
    setPending(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create the account");
      return;
    }
    const employee = mode === "employee";
    writeStoredWorkspaceMode(employee ? "company" : "hunter");
    router.push(employee ? ROUTES.company : nextPath);
    router.refresh();
  };

  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Heading level={1}>Create your account</Heading>
          <Text color="secondary">
            This account is yours. Join as a candidate, or as an employee of a company.
          </Text>
        </Stack>
        {error ? <Banner status="error" title={error} /> : null}
        <TextInput label="Name" value={name} onChange={setName} />
        <TextInput label="Email" type="email" value={email} onChange={setEmail} />
        <TextInput label="Password" type="password" value={password} onChange={setPassword} />
        <RadioList label="Join as" value={mode} onChange={(value) => setMode(value as AccountMode)}>
          <RadioListItem
            value="candidate"
            label="Join as Candidate"
            description="Search jobs and track your applications."
          />
          <RadioListItem
            value="employee"
            label="Join as Employee"
            description="Link a company we already have, or create a company page."
          />
        </RadioList>
        {mode === "employee" ? (
          <CompanyFields path={path} onPath={setPath} onChoice={onChoice} />
        ) : null}
        <Button
          label="Create account"
          variant="primary"
          clickAction={submit}
          isDisabled={pending}
        />
        <Text color="secondary">
          Already have an account? <Link href={signInHref}>Sign in</Link>
        </Text>
      </Stack>
    </Card>
  );
}
