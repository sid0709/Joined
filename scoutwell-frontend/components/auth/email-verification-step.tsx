"use client";

import { useState } from "react";
import {
  Banner,
  Button,
  Card,
  CodeInput,
  Heading,
  Link,
  Stack,
  Text,
  type CodeInputStatus,
} from "@joined/design-system";
import { EMAIL_VERIFICATION_CODE_LENGTH, isValidVerificationCode } from "@/lib/auth/verification";

type EmailVerificationStepProps = {
  email: string;
  /** Called once the code matches; rejects with a message to show above the code. */
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
  const [status, setStatus] = useState<CodeInputStatus>("default");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const verify = async (entered: string) => {
    setError("");
    if (!isValidVerificationCode(entered)) {
      setStatus("error");
      setError("That code is not right. Check it and try again.");
      return;
    }
    setStatus("success");
    setIsSubmitting(true);
    try {
      await onVerified();
    } catch (err) {
      setStatus("default");
      setError(err instanceof Error ? err.message : "Could not create the account.");
      setIsSubmitting(false);
    }
  };

  const change = (next: string) => {
    setCode(next);
    setStatus("default");
    setError("");
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
        <CodeInput
          label="Verification code"
          isLabelHidden
          length={EMAIL_VERIFICATION_CODE_LENGTH}
          value={code}
          onChange={change}
          onComplete={(entered) => void verify(entered)}
          status={status}
          isDisabled={isSubmitting}
          hasAutoFocus
        />
        <Button
          label="Verify and create account"
          variant="primary"
          clickAction={() => verify(code)}
          isDisabled={code.length < EMAIL_VERIFICATION_CODE_LENGTH || isSubmitting}
        />
        <Text color="secondary">
          Wrong address? <Link onClick={onChangeEmail}>Change email</Link>
        </Text>
      </Stack>
    </Card>
  );
}
