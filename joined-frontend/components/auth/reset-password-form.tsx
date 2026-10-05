"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  FormLayout,
  Heading,
  Link,
  Stack,
  Text,
  TextInput,
} from "@joined/design-system";
import {
  EMAIL_APP_ROUTES,
  EMAIL_MESSAGES,
  RESET_NOTICE_PARAM,
  RESET_NOTICE_VALUE,
  fieldStatus,
  resetRequest,
  submitEmailAuth,
  validatePassword,
  validatePasswordConfirm,
} from "@/lib/auth/email";
import { ROUTES } from "@/lib/routes";

export function ResetPasswordForm({ token, nextPath }: { token: string; nextPath: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const passwordError = submitted ? validatePassword(password) : undefined;
  const confirmError = submitted ? validatePasswordConfirm(password, confirm) : undefined;
  const signInHref = `${ROUTES.signIn}?next=${encodeURIComponent(nextPath)}`;

  if (!token) {
    return (
      <Card padding={6}>
        <Stack gap={5}>
          <Stack gap={1}>
            <Heading level={1}>Reset password</Heading>
            <Text color="secondary">{EMAIL_MESSAGES.resetMissing}</Text>
          </Stack>
          <Banner status="error" title={EMAIL_MESSAGES.resetFailed} />
          <Text color="secondary">
            <Link href={ROUTES.forgotPassword}>Request a new reset link</Link>
          </Text>
        </Stack>
      </Card>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (validatePassword(password) || validatePasswordConfirm(password, confirm)) return;
    setPending(true);
    const result = await submitEmailAuth(
      EMAIL_APP_ROUTES.reset,
      resetRequest({ token, newPassword: password }),
    );
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const signedIn = new URLSearchParams({
      next: nextPath,
      [RESET_NOTICE_PARAM]: RESET_NOTICE_VALUE,
    });
    router.push(`${ROUTES.signIn}?${signedIn}`);
  };

  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Heading level={1}>Reset password</Heading>
          <Text color="secondary">Choose a new password, then sign in with it.</Text>
        </Stack>
        <form onSubmit={(event) => void submit(event)}>
          <FormLayout>
            <TextInput
              label="New password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              description="At least 8 characters."
              isRequired
              isDisabled={pending}
              status={fieldStatus(passwordError)}
            />
            <TextInput
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              isRequired
              isDisabled={pending}
              status={fieldStatus(confirmError)}
            />
            {error ? <Banner status="error" title={error} /> : null}
            <Button
              type="submit"
              label="Reset password"
              variant="primary"
              width="100%"
              isLoading={pending}
              isDisabled={pending}
            />
          </FormLayout>
        </form>
        <Text color="secondary">
          <Link href={signInHref}>Back to sign in</Link>
        </Text>
      </Stack>
    </Card>
  );
}
