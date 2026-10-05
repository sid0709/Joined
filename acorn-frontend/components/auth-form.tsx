"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GOOGLE_AUTH_ROUTE } from "@joined/google-signin";
import {
  Banner,
  Button,
  FormLayout,
  GoogleSignInButton,
  Link,
  Stack,
  Text,
  TextInput,
} from "sid-ui";
import { signIn, signUp } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/routes";

export function AuthForm({
  mode,
  googleError = "",
}: {
  mode: "sign-in" | "sign-up";
  googleError?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const creating = mode === "sign-up";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setPending(true);
    const result = creating ? await signUp(name, email, password) : await signIn(email, password);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push(ROUTES.overview);
    router.refresh();
  };

  return (
    <Stack gap={6}>
      {googleError ? <Banner status="error" title={googleError} /> : null}
      <GoogleSignInButton
        action={GOOGLE_AUTH_ROUTE}
        next={ROUTES.overview}
        label={creating ? "Sign up with Google" : "Continue with Google"}
      />
      <Text color="secondary">or use email</Text>
      <form onSubmit={(event) => void submit(event)}>
        <FormLayout>
          {creating ? (
            <TextInput
              label="Name"
              value={name}
              onChange={setName}
              autoComplete="name"
              isRequired
              isDisabled={pending}
            />
          ) : null}
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            isRequired
            isDisabled={pending}
          />
          <TextInput
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={creating ? "new-password" : "current-password"}
            isRequired
            isDisabled={pending}
          />
          {error ? <Banner status="error" title={error} /> : null}
          <Button
            type="submit"
            label={creating ? "Create account" : "Sign in"}
            variant="primary"
            width="100%"
            isLoading={pending}
            isDisabled={pending}
          />
          <Text color="secondary">
            {creating ? (
              <Link href={ROUTES.signIn}>Already have an account? Sign in</Link>
            ) : (
              <Link href={ROUTES.signUp}>New here? Create an account</Link>
            )}
          </Text>
        </FormLayout>
      </form>
    </Stack>
  );
}
