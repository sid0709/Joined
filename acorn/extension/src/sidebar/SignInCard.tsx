import type { AcornFaceMode } from "@acorn/face";
import { Button, Text, VStack } from "@joined/design-system";
import { ACORN_FACE_HELP_PX } from "../acorn-face/constants";
import { AcornFaceView } from "../acorn-face/AcornFaceView";

type SignInCardProps = {
  authBusy: boolean;
  faceMode: AcornFaceMode;
  onSignIn: () => void;
};

/** Signed-out welcome: Acorn shares the Joined session, so sign-in is one button. */
export function SignInCard({ authBusy, faceMode, onSignIn }: SignInCardProps) {
  return (
    <VStack gap={4} align="center" justify="center" className="acorn-welcome">
      <AcornFaceView mode={faceMode} size={ACORN_FACE_HELP_PX} live label="Acorn" />
      <VStack gap={1} align="center">
        <Text as="h1" type="display-3" weight="semibold">
          Acorn
        </Text>
        <Text type="supporting" justify="center">
          Fills job applications with your Joined profile and the right résumé.
        </Text>
      </VStack>
      <Button
        variant="primary"
        size="lg"
        label={authBusy ? "Connecting…" : "Continue with Joined"}
        isLoading={authBusy}
        isDisabled={authBusy}
        width="100%"
        onClick={onSignIn}
      />
      <Text type="supporting" color="secondary" justify="center">
        Sign in to Joined in this browser first.
      </Text>
    </VStack>
  );
}
