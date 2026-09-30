"use client";

import { useState } from "react";
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
import {
  EMAIL_VERIFICATION_CODE_LENGTH,
  isValidVerificationCode,
  normalizeVerificationCode,
} from "@/lib/auth/verification";

type EmailVerificationStepProps = {
  email: string;
  /** Called once the code matches; rejects with a message to show under the field. */
  onVerified: () => Promise<void>;
  /** Back to the details step, e.g. to fix a mistyped email. */
  onChangeEmail: () => void;
};

export function EmailVerificationStep({
  email,
  onVerified,
  onChangeEmail,
}: EmailVerificationStepProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const verify = async () => {
    setError("");
    if (!isValidVerificationCode(code)) {
      setError("That code is not right. Check it and try again.");
      return;
    }
    try {
      await onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    }
  };

  return (
    <Card padding={8}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>Verify your email</Heading>
          <Text color="secondary" display="block">
            Enter the {EMAIL_VERIFICATION_CODE_LENGTH}-digit code we sent to {email}.
          </Text>
        </Stack>
        {error ? <Banner status="error" title={error} /> : null}
        <TextInput
          label="Verification code"
          value={code}
          onChange={(value) => setCode(normalizeVerificationCode(value))}
          autoComplete="one-time-code"
          hasAutoFocus
          onEnter={() => void verify()}
        />
        <Button
          label="Verify and create account"
          variant="primary"
          clickAction={verify}
          isDisabled={code.length < EMAIL_VERIFICATION_CODE_LENGTH}
        />
        <Text color="secondary">
          Wrong address? <Link onClick={onChangeEmail}>Change email</Link>
        </Text>
      </Stack>
    </Card>
  );
}
