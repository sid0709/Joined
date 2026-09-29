"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  Heading,
  Link,
  Stack,
  Text,
  TextInput,
} from "@openseat/design-system";
import { ApiError } from "@openseat/scout";
import { ROUTES } from "@/lib/routes";
import { authSend } from "@/lib/scout/client";

/** The API's password rule, echoed so people see it before they submit. */
const MIN_PASSWORD = 8;

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    try {
      await authSend("signup", { name, email, password });
      router.replace(ROUTES.onboarding);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the account.");
    }
  };

  return (
    <Card padding={8}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>Become a scout</Heading>
          <Text color="secondary" display="block">
            Find official openings the big boards miss. Earn when job hunters actually use them.
          </Text>
        </Stack>
        {error ? <Banner status="error" title={error} /> : null}
        <Stack gap={4}>
          <TextInput
            label="Full name"
            value={name}
            onChange={setName}
            autoComplete="name"
            hasAutoFocus
          />
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <TextInput
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            description={`At least ${MIN_PASSWORD} characters.`}
            onEnter={() => void submit()}
          />
        </Stack>
        <Button
          label="Create account"
          variant="primary"
          clickAction={submit}
          isDisabled={!name.trim() || !email.trim() || password.length < MIN_PASSWORD}
        />
        <Text color="secondary">
          Already scouting? <Link href={ROUTES.signIn}>Sign in</Link>
        </Text>
      </Stack>
    </Card>
  );
}
