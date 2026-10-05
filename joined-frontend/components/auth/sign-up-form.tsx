"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Divider,
  GoogleSignInButton,
  Heading,
  Link,
  RadioList,
  RadioListItem,
  Stack,
  Text,
} from "@joined/design-system";
import { GOOGLE_SIGNIN_ROUTE } from "@joined/google-signin";
import { allowEmailSignup, type AccountMode } from "@/lib/auth/email";
import { isCompanyModeEnabled } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import { EmailSignUpFields } from "./email-sign-up-fields";

type Step = "mode" | "account";

/**
 * Candidate accounts can use email or Google. Company/employer email sign-up is
 * never offered; the employee path stays Google-only when company mode is on.
 */
export function SignUpForm({ nextPath, hiring }: { nextPath: string; hiring: boolean }) {
  const companyModeEnabled = isCompanyModeEnabled();
  const showModeStep = companyModeEnabled && !hiring;
  const [step, setStep] = useState<Step>(showModeStep ? "mode" : "account");
  const [mode, setMode] = useState<AccountMode>(
    companyModeEnabled && hiring ? "employee" : "candidate",
  );
  const signInHref = `${ROUTES.signIn}?next=${encodeURIComponent(nextPath)}`;
  const employee = mode === "employee";
  const emailSignup = allowEmailSignup(mode);

  return (
    <Card padding={6}>
      <Stack gap={5}>
        {step === "mode" ? (
          <>
            <Stack gap={1}>
              <Heading level={1}>How will you join?</Heading>
              <Text color="secondary">
                Choose first. The account you create next depends on this.
              </Text>
            </Stack>
            <RadioList
              label="Join as"
              value={mode}
              onChange={(value) => setMode(value as AccountMode)}
            >
              <RadioListItem
                value="candidate"
                label="Join as Candidate"
                description="Search jobs and track your applications."
              />
              <RadioListItem
                value="employee"
                label="Join as Employee"
                description="Hire for your company. You’ll link it or create its page next."
              />
            </RadioList>
            <Button label="Continue" variant="primary" clickAction={() => setStep("account")} />
          </>
        ) : (
          <>
            <Stack gap={1}>
              <Heading level={1}>
                {employee ? "Create your employee account" : "Create your account"}
              </Heading>
              <Text color="secondary">
                {employee
                  ? "Sign up with your Google account. Next, link a company already on Joined or create its page."
                  : "Create a job-seeker account with email or Google."}
              </Text>
            </Stack>
            {emailSignup ? <EmailSignUpFields /> : null}
            {emailSignup ? <Divider label="or" /> : null}
            <Stack gap={2}>
              <GoogleSignInButton
                action={GOOGLE_SIGNIN_ROUTE}
                next={employee ? ROUTES.hiringSetup : nextPath}
                mode={mode}
                label="Sign up with Google"
              />
              {employee ? null : (
                <Text type="supporting" color="secondary">
                  Google also asks to connect your calendar so interviews sync. You can skip it.
                </Text>
              )}
            </Stack>
            {showModeStep ? (
              <Button label="Back" variant="ghost" clickAction={() => setStep("mode")} />
            ) : null}
          </>
        )}
        <Text color="secondary">
          Already have an account? <Link href={signInHref}>Sign in</Link>
        </Text>
      </Stack>
    </Card>
  );
}
