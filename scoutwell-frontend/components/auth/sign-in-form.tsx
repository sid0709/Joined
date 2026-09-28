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
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/config";
import { ROUTES, safeNextPath } from "@/lib/routes";
import { useScout } from "@/lib/scout-store";

export function SignInForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const scout = useScout();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const destination = safeNextPath(nextPath);

  const submit = () => {
    const result = scout.signIn(email, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const user = result.state.users.find((item) => item.id === result.state.activeUserId);
    router.push(
      user && (!user.acceptedTermsAt || !user.emailVerified || !user.phoneVerified)
        ? ROUTES.onboarding
        : destination,
    );
  };

  return (
    <Card padding={6}>
      <Stack gap={5}>
        <Stack gap={1}>
          <Heading level={1}>Sign in</Heading>
          <Text color="secondary" display="block">
            Demo account is prefilled. Password is local-only — there is no backend.
          </Text>
        </Stack>
        {error ? <Banner status="error" title={error} /> : null}
        <TextInput label="Email" type="email" value={email} onChange={setEmail} />
        <TextInput label="Password" type="password" value={password} onChange={setPassword} />
        <Button label="Sign in" variant="primary" clickAction={submit} />
        <Text color="secondary">
          New scout? <Link href={ROUTES.signUp}>Create an account</Link>
        </Text>
      </Stack>
    </Card>
  );
}
