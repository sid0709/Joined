import { Card, Drawer, HStack, Text, VStack } from "sid-ui";
import { ACORN_FACE_HELP_PX } from "../acorn-face/constants";
import { ACORN_FACE_GUIDE } from "../acorn-face/guide";
import { AcornFaceView } from "../acorn-face/AcornFaceView";

type FaceGuidePanelProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  thinking: number;
  working: number;
};

/** Every mood the Acorn Face shows, with live counts of what is thinking and working. */
export function FaceGuidePanel({ isOpen, onOpenChange, thinking, working }: FaceGuidePanelProps) {
  const total = thinking + working;

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Acorn Face guide"
      subtitle="Each mood the acorn shows while Fill or Custom is in flight."
      size="full"
    >
      <VStack gap={3} className="face-guide">
        <HStack gap={2}>
          {[
            { n: thinking, label: "Thinking" },
            { n: working, label: "Working" },
            { n: total, label: "Total" },
          ].map((stat) => (
            <Card key={stat.label} variant="muted" padding={3} width="100%">
              <VStack gap={0}>
                <Text type="large" weight="semibold" hasTabularNumbers>
                  {stat.n}
                </Text>
                <Text type="supporting">{stat.label}</Text>
              </VStack>
            </Card>
          ))}
        </HStack>
        <VStack as="ul" gap={2} className="face-guide-modes">
          {ACORN_FACE_GUIDE.map((row) => (
            <HStack as="li" key={row.mode} gap={3} align="center">
              <AcornFaceView
                className="face-guide-face"
                mode={row.mode}
                size={ACORN_FACE_HELP_PX}
                live
                label={row.title}
              />
              <VStack gap={0}>
                <Text weight="semibold">{row.title}</Text>
                <Text type="supporting">{row.detail}</Text>
              </VStack>
            </HStack>
          ))}
        </VStack>
      </VStack>
    </Drawer>
  );
}
