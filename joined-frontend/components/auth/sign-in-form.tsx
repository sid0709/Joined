"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, Card, Heading, Link, Stack, Text, TextInput } from "@joined/design-system";
import { writeStoredWorkspaceMode } from "@/lib/workspace-preference";
import { ROUTES } from "@/lib/routes";

export function SignInForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const signUpHref = `${ROUTES.signUp}?next=${encodeURIComponent(nextPath)}`;

  const submit = async () => {
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setPending(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not sign in");
      return;
    }
    if (nextPath.startsWith(ROUTES.company) || nextPath.startsWith("/hiring")) {
      writeStoredWorkspaceMode("company");
    }
    router.push(nextPath);
    router.refresh();
  };

  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Heading level={1}>Sign in</Heading>
          <Text color="secondary">
            Accounts are for people. You’ll set up hiring after you’re in.
          </Text>
        </Stack>
        {error ? <Banner status="error" title={error} /> : null}
        <TextInput label="Email" type="email" value={email} onChange={setEmail} />
        <TextInput label="Password" type="password" value={password} onChange={setPassword} />
        <Button label="Sign in" variant="primary" clickAction={submit} isDisabled={pending} />
        <Text color="secondary">
          New here? <Link href={signUpHref}>Create an account</Link>
        </Text>
      </Stack>
    </Card>
  );
}
