"use client";

import { useState, type FormEvent } from "react";
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
  fieldStatus,
  forgotRequest,
  submitEmailAuth,
  validateEmail,
} from "@/lib/auth/email";
import { ROUTES } from "@/lib/routes";

export function ForgotPasswordForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const emailError = submitted && !sent ? validateEmail(email) : undefined;
  const signInHref = `${ROUTES.signIn}?next=${encodeURIComponent(nextPath)}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (validateEmail(email)) return;
    setPending(true);
    const result = await submitEmailAuth(EMAIL_APP_ROUTES.resetRequest, forgotRequest(email));
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSent(true);
  };

  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Heading level={1}>Forgot password</Heading>
          <Text color="secondary">
            Enter your email. If that address has an account, we send a reset link. The message is
            the same either way.
          </Text>
        </Stack>
        {sent ? (
          <Banner status="success" title={EMAIL_MESSAGES.forgotSuccess} />
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            <FormLayout>
              <TextInput
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                isRequired
                isDisabled={pending}
                status={fieldStatus(emailError)}
              />
              {error ? <Banner status="error" title={error} /> : null}
              <Button
                type="submit"
                label="Send reset link"
                variant="primary"
                width="100%"
                isLoading={pending}
                isDisabled={pending}
              />
            </FormLayout>
          </form>
        )}
        <Text color="secondary">
          <Link href={signInHref}>Back to sign in</Link>
        </Text>
      </Stack>
    </Card>
  );
}
