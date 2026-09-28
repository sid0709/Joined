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
type Step = "mode" | "account";

export function SignUpForm({ nextPath, hiring }: { nextPath: string; hiring: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(hiring ? "account" : "mode");
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
  const employee = mode === "employee";
  const accountReady =
    name.trim() !== "" &&
    email.trim() !== "" &&
    password.length >= MIN_PASSWORD &&
    (!employee || company != null);

  const chooseMode = (next: AccountMode) => {
    setMode(next);
    setError("");
    if (next === "candidate") setCompany(null);
  };

  const submit = async () => {
    if (password.length < MIN_PASSWORD) {
      setError("Use at least 8 characters.");
      return;
    }
    if (employee && !company) {
      setError(
        path === "link"
          ? "Link a company, or create a new one. A company is required."
          : "Enter the company name. Creating a company is required.",
      );
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
        mode,
        ...(employee && company ? { company } : {}),
      }),
    });
    setPending(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create the account");
      return;
    }
    writeStoredWorkspaceMode(employee ? "company" : "hunter");
    router.push(employee ? ROUTES.company : nextPath);
    router.refresh();
  };

  return (
    <Card padding={6}>
      <Stack gap={5}>
        {step === "mode" ? (
          <>
            <Stack gap={1}>
              <Heading level={1}>How will you join?</Heading>
              <Text color="secondary">
                Choose first. The account you create next depends on this.
              </Text>
            </Stack>
            <RadioList
              label="Join as"
              value={mode}
              onChange={(value) => chooseMode(value as AccountMode)}
            >
              <RadioListItem
                value="candidate"
                label="Join as Candidate"
                description="Search jobs and track your applications. Name, email, and password only."
              />
              <RadioListItem
                value="employee"
                label="Join as Employee"
                description="Link a company we already have, or create a new company page."
              />
            </RadioList>
            <Button label="Continue" variant="primary" clickAction={() => setStep("account")} />
          </>
        ) : (
          <>
            <Stack gap={1}>
              <Heading level={1}>
                {employee ? "Create your employee account" : "Create your account"}
              </Heading>
              <Text color="secondary">
                {employee
                  ? "Link a company already on Opened, or create a new one. If you don’t link a company, creating one is required."
                  : "Your candidate account is just a name, email, and password."}
              </Text>
            </Stack>
            {error ? <Banner status="error" title={error} /> : null}
            {employee ? <CompanyFields path={path} onPath={setPath} onChoice={onChoice} /> : null}
            <TextInput label="Name" value={name} onChange={setName} />
            <TextInput label="Email" type="email" value={email} onChange={setEmail} />
            <TextInput label="Password" type="password" value={password} onChange={setPassword} />
            <Button
              label="Create account"
              variant="primary"
              clickAction={submit}
              isDisabled={pending || !accountReady}
            />
            <Button
              label="Back"
              variant="ghost"
              clickAction={() => {
                setError("");
                setStep("mode");
              }}
            />
          </>
        )}
        <Text color="secondary">
          Already have an account? <Link href={signInHref}>Sign in</Link>
        </Text>
      </Stack>
    </Card>
  );
}
