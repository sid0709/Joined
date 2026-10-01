"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  Divider,
  GoogleSignInButton,
  Heading,
  Link,
  Stack,
  Text,
  TextInput,
} from "@joined/design-system";
import { GOOGLE_SIGNIN_ROUTE } from "@joined/google-signin";
import { ApiError } from "@joined/scout";
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import { authSend } from "@/lib/scout/client";

/** `googleError` explains why a Google sign-in came back here, when one did. */
export function SignInForm({ nextPath, googleError }: { nextPath: string; googleError: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(googleError);

  const submit = async () => {
    setError("");
    try {
      await authSend("signin", { email, password });
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Try again.");
    }
  };

  return (
    <Card padding={8}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>Welcome back</Heading>
          <Text color="secondary" display="block">
            Sign in to {BRAND}. A scout account is only for submitting jobs.
          </Text>
        </Stack>
        {error ? <Banner status="error" title={error} /> : null}
        <GoogleSignInButton action={GOOGLE_SIGNIN_ROUTE} next={nextPath} />
        <Divider label="or" />
        <Stack gap={4}>
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            hasAutoFocus
          />
          <TextInput
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            onEnter={() => void submit()}
          />
        </Stack>
        <Button
          label="Sign in"
          variant="primary"
          clickAction={submit}
          isDisabled={!email.trim() || !password}
        />
        <Text color="secondary">
          New to scouting? <Link href={ROUTES.signUp}>Create an account</Link>
        </Text>
      </Stack>
    </Card>
  );
}
