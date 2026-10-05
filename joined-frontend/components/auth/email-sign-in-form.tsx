"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, FormLayout, Link, Stack, Text, TextInput } from "sid-ui";
import {
  EMAIL_APP_ROUTES,
  fieldStatus,
  signinRequest,
  submitEmailAuth,
  validateEmail,
  validatePassword,
} from "@/lib/auth/email";
import { ROUTES } from "@/lib/routes";

export function EmailSignInForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const emailError = submitted ? validateEmail(email) : undefined;
  const passwordError = submitted ? validatePassword(password) : undefined;
  const forgotHref = `${ROUTES.forgotPassword}?next=${encodeURIComponent(nextPath)}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (validateEmail(email) || validatePassword(password)) return;
    setPending(true);
    const result = await submitEmailAuth(
      EMAIL_APP_ROUTES.signin,
      signinRequest({ email, password }),
    );
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push(nextPath);
    router.refresh();
  };

  return (
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
        <TextInput
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          isRequired
          isDisabled={pending}
          status={fieldStatus(passwordError)}
        />
        {error ? <Banner status="error" title={error} /> : null}
        <Button
          type="submit"
          label="Sign in with email"
          variant="primary"
          width="100%"
          isLoading={pending}
          isDisabled={pending}
        />
        <Stack gap={1}>
          <Text type="supporting" color="secondary">
            New accounts need a verified email before they can sign in.
          </Text>
          <Text color="secondary">
            <Link href={forgotHref}>Forgot your password?</Link>
          </Text>
        </Stack>
      </FormLayout>
    </form>
  );
}
