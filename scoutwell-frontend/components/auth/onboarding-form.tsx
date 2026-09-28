"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  CheckboxInput,
  Heading,
  Stack,
  Step,
  Stepper,
  Text,
  TextInput,
} from "@openseat/design-system";
import { MOCK_OTP, OTP_LENGTH } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import { useScout } from "@/lib/scout-store";

function stepIndex(termsDone: boolean, emailDone: boolean) {
  if (!termsDone) return 0;
  if (!emailDone) return 1;
  return 2;
}

export function OnboardingForm() {
  const router = useRouter();
  const scout = useScout();
  const user = scout.user;
  const [code, setCode] = useState(MOCK_OTP);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [phoneCode, setPhoneCode] = useState(MOCK_OTP);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!scout.ready) return;
    if (!user) router.replace(ROUTES.signIn);
  }, [router, scout.ready, user]);

  if (!user) {
    return (
      <Card padding={6}>
        <Stack gap={3}>
          <Heading level={1}>Sign in first</Heading>
          <Text color="secondary">Scout onboarding continues after you have an account.</Text>
          <Button label="Sign in" variant="primary" href={ROUTES.signIn} />
        </Stack>
      </Card>
    );
  }

  const termsDone = Boolean(user.acceptedTermsAt);
  const emailDone = user.emailVerified;
  const phoneDone = user.phoneVerified;
  const current = stepIndex(termsDone, emailDone);

  const run = (action: () => { ok: boolean; error?: string }, next?: () => void) => {
    const result = action();
    if (!result.ok) {
      setError(result.error ?? "Could not continue");
      return;
    }
    setError("");
    next?.();
  };

  return (
    <Card padding={6}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>Activate scout mode</Heading>
          <Text color="secondary" display="block">
            Accept the terms, then verify email and phone. Payouts later need a government ID.
          </Text>
        </Stack>
        <Stepper activeStep={current} orientation="horizontal">
          <Step step={0} label="Terms" />
          <Step step={1} label="Email" />
          <Step step={2} label="Phone" />
        </Stepper>
        {error ? <Banner status="error" title={error} /> : null}
        {!termsDone ? (
          <Stack gap={4}>
            <Text display="block">
              You submit official apply links only. Rewards are for settled interviews, confirmed
              hires, and companies that start paying — not for how many URLs you add. Collusion with
              a client or bidder voids earnings.
            </Text>
            <CheckboxInput
              label="I accept the scout terms"
              value={false}
              onChange={(checked) => {
                if (checked) run(() => scout.acceptTerms());
              }}
            />
          </Stack>
        ) : null}
        {termsDone && !emailDone ? (
          <Stack gap={4}>
            <TextInput
              label="Email code"
              value={code}
              onChange={setCode}
              description={`Demo code is ${MOCK_OTP}.`}
            />
            <Button
              label="Verify email"
              variant="primary"
              clickAction={() => run(() => scout.verifyEmail(code))}
              isDisabled={code.trim().length !== OTP_LENGTH}
            />
          </Stack>
        ) : null}
        {termsDone && emailDone && !phoneDone ? (
          <Stack gap={4}>
            <TextInput label="Phone" value={phone} onChange={setPhone} placeholder="+1 555 0100" />
            <TextInput
              label="SMS code"
              value={phoneCode}
              onChange={setPhoneCode}
              description={`Demo code is ${MOCK_OTP}. VoIP numbers would be rejected in production.`}
            />
            <Button
              label="Verify phone"
              variant="primary"
              clickAction={() =>
                run(
                  () => scout.verifyPhone(phone, phoneCode),
                  () => router.replace(ROUTES.dashboard),
                )
              }
            />
          </Stack>
        ) : null}
        {termsDone && emailDone && phoneDone ? (
          <Button label="Go to dashboard" variant="primary" href={ROUTES.dashboard} />
        ) : null}
      </Stack>
    </Card>
  );
}
