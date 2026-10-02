import { Card, HStack, Text, VStack } from "@joined/design-system";
import { ACORN_FACE_HELP_PX } from "../acorn-face/constants";
import { ACORN_FACE_GUIDE } from "../acorn-face/guide";
import { AcornFaceView } from "../acorn-face/AcornFaceView";

type FaceGuidePanelProps = {
  thinking: number;
  working: number;
};

export function FaceGuidePanel({ thinking, working }: FaceGuidePanelProps) {
  const total = thinking + working;

  return (
    <VStack as="section" gap={3} className="face-guide" aria-label="Acorn Face guide">
      <Text type="supporting">Each mood the acorn shows while Fill or Custom is in flight.</Text>
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
  );
}
