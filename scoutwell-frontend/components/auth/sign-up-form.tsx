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
import { ROUTES } from "@/lib/routes";
import { useScout } from "@/lib/scout-store";

const MIN_PASSWORD = 8;

export function SignUpForm() {
  const router = useRouter();
  const scout = useScout();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const result = scout.signUp({ name, email, passwordText: password });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(ROUTES.onboarding);
  };

  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Heading level={1}>Become a scout</Heading>
          <Text color="secondary" display="block">
            Submit official job links. You are paid when those jobs produce interviews, hires, and
            paying companies — never for volume.
          </Text>
        </Stack>
        {error ? <Banner status="error" title={error} /> : null}
        <TextInput label="Full name" value={name} onChange={setName} isRequired />
        <TextInput label="Email" type="email" value={email} onChange={setEmail} isRequired />
        <TextInput
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          description={`At least ${MIN_PASSWORD} characters. Stored only in this browser.`}
        />
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
