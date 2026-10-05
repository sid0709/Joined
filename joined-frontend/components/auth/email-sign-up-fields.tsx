"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, FormLayout, TextInput } from "@joined/design-system";
import {
  EMAIL_APP_ROUTES,
  checkEmailHref,
  fieldStatus,
  signupRequest,
  submitEmailAuth,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/auth/email";

export function EmailSignUpFields() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const nameError = submitted ? validateName(name) : undefined;
  const emailError = submitted ? validateEmail(email) : undefined;
  const passwordError = submitted ? validatePassword(password) : undefined;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (validateName(name) || validateEmail(email) || validatePassword(password)) return;
    setPending(true);
    const result = await submitEmailAuth(
      EMAIL_APP_ROUTES.signup,
      signupRequest({ name, email, password }),
    );
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push(checkEmailHref(email.trim()));
  };

  return (
    <form onSubmit={(event) => void submit(event)}>
      <FormLayout>
        <TextInput
          label="Name"
          value={name}
          onChange={setName}
          autoComplete="name"
          isRequired
          isDisabled={pending}
          status={fieldStatus(nameError)}
        />
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
          autoComplete="new-password"
          description="At least 8 characters."
          isRequired
          isDisabled={pending}
          status={fieldStatus(passwordError)}
        />
        {error ? <Banner status="error" title={error} /> : null}
        <Button
          type="submit"
          label="Create account with email"
          variant="primary"
          width="100%"
          isLoading={pending}
          isDisabled={pending}
        />
      </FormLayout>
    </form>
  );
}
