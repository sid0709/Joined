import type { AcornFaceMode } from "@acorn/face";
import { Button, Text, VStack } from "sid-ui";
import { ACORN_FACE_HELP_PX } from "../acorn-face/constants";
import { AcornFaceView } from "../acorn-face/AcornFaceView";

type SignInCardProps = {
  authBusy: boolean;
  faceMode: AcornFaceMode;
  onSignIn: () => void;
};

/** Signed-out welcome: Acorn shares the acorn-frontend session, so sign-in is one button. */
export function SignInCard({ authBusy, faceMode, onSignIn }: SignInCardProps) {
  return (
    <VStack gap={4} align="center" justify="center" className="acorn-welcome">
      <AcornFaceView mode={faceMode} size={ACORN_FACE_HELP_PX} live label="Acorn" />
      <VStack gap={1} align="center">
        <Text as="h1" type="display-3" weight="semibold">
          Acorn
        </Text>
        <Text type="supporting" justify="center">
          Fills job applications with your Acorn account and the right résumé.
        </Text>
      </VStack>
      <Button
        variant="primary"
        size="lg"
        label={authBusy ? "Connecting…" : "Continue"}
        isLoading={authBusy}
        isDisabled={authBusy}
        width="100%"
        onClick={onSignIn}
      />
      <Text type="supporting" color="secondary" justify="center">
        Sign in on the Acorn site in this browser first.
      </Text>
    </VStack>
  );
}
