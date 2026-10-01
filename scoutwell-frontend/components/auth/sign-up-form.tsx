"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Heading, Link, Stack, Text, TextInput } from "@joined/design-system";
import { ApiError } from "@joined/scout";
import { ROUTES } from "@/lib/routes";
import { authSend } from "@/lib/scout/client";
import { EmailVerificationStep } from "./email-verification-step";

/** The API's password rule, echoed so people see it before they submit. */
const MIN_PASSWORD = 8;

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const canContinue = Boolean(name.trim() && email.trim()) && password.length >= MIN_PASSWORD;

  const continueToVerification = () => {
    if (canContinue) setIsVerifying(true);
  };

  /** Runs only after the emailed code is confirmed. */
  const createAccount = async () => {
    try {
      await authSend("signup", { name, email, password });
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : "Could not create the account.");
    }
    router.replace(ROUTES.onboarding);
    router.refresh();
  };

  if (isVerifying) {
    return (
      <EmailVerificationStep
        email={email}
        onVerified={createAccount}
        onChangeEmail={() => setIsVerifying(false)}
      />
    );
  }

  return (
    <Card padding={8}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>Become a scout</Heading>
          <Text color="secondary" display="block">
            Find official openings the big boards miss. Earn when job hunters actually use them.
          </Text>
        </Stack>
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
            onEnter={continueToVerification}
          />
        </Stack>
        <Button
          label="Continue"
          variant="primary"
          clickAction={continueToVerification}
          isDisabled={!canContinue}
        />
        <Text color="secondary">
          Already scouting? <Link href={ROUTES.signIn}>Sign in</Link>
        </Text>
      </Stack>
    </Card>
  );
}
