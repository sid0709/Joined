"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Card,
  Center,
  ClickableCard,
  Dialog,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  Heading,
  Stack,
  Text,
  type GlyphName,
} from "@openseat/design-system";
import { BRAND, ROUTES, type WorkspaceMode } from "@/lib/routes";
import {
  getServerWorkspaceMode,
  readStoredWorkspaceMode,
  subscribeToWorkspaceMode,
} from "@/lib/workspace-preference";
import { useSwitchMode } from "./use-switch-mode";

const ICON_TILE = 56;
const CONTENT_MAX_WIDTH = 880;
const HEADER_MAX_WIDTH = 560;
const MIN_HEIGHT = "100%";

type Path = {
  mode: WorkspaceMode;
  icon: GlyphName;
  title: string;
  description: string;
  points: string[];
  cta: string;
};

const PATHS: Path[] = [
  {
    mode: "hunter",
    icon: "search",
    title: "Join as a candidate",
    description: "Search, apply, and track it all in one place.",
    points: [
      "Search direct jobs, plus ones hidden from the big boards",
      "Every application and interview tracked automatically",
      "One profile follows you to every job",
    ],
    cta: "Continue as a candidate",
  },
  {
    mode: "company",
    icon: "seat",
    title: "Join as an employer",
    description: "Post jobs and run your hiring pipeline.",
    points: [
      "Post jobs for free — no listing fees",
      "Every applicant comes with a fit score",
      "Pay only when a candidate attends an interview",
    ],
    cta: "Continue as an employer",
  },
];

/** A one-time fork on first visit (no mode cookie yet): candidate or employer decides which mode opens. */
const AUTH_PATHS = [ROUTES.signIn, ROUTES.signUp, ROUTES.hiringSetup];

export function ModePicker() {
  const pathname = usePathname();
  const router = useRouter();
  const switchMode = useSwitchMode();
  // "unresolved" (SSR / first client render) reads as already-chosen, so nobody sees a flash
  // of the picker before React can check localStorage; a genuine `null` opens it for real.
  const storedMode = useSyncExternalStore(
    subscribeToWorkspaceMode,
    readStoredWorkspaceMode,
    getServerWorkspaceMode,
  );
  const [dismissed, setDismissed] = useState(false);
  const onAuthPath = AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const isOpen = storedMode === null && !dismissed && !onAuthPath;

  const choose = (path: Path) => {
    setDismissed(true);
    if (path.mode === "company") {
      router.push(`${ROUTES.signUp}?intent=hiring`);
      return;
    }
    switchMode(path.mode);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={() => {}}
      variant="fullscreen"
      purpose="required"
      aria-label={`Choose how you’ll use ${BRAND}`}
    >
      <Center axis="both" minHeight={MIN_HEIGHT} width="100%" padding={6}>
        <Stack gap={8} hAlign="center" width="100%">
          <Stack gap={2} hAlign="center" maxWidth={HEADER_MAX_WIDTH}>
            <Text type="label" color="accent">
              {BRAND}
            </Text>
            <Heading level={1} justify="center">
              How will you use {BRAND}?
            </Heading>
            <Text color="secondary" justify="center" display="block">
              Pick one to get started. You can switch anytime from your account menu.
            </Text>
          </Stack>

          <Stack width="100%" maxWidth={CONTENT_MAX_WIDTH}>
            <GridSystem gap={5} align="stretch" responsiveTo="viewport">
              {PATHS.map((path) => (
                <GridColumn key={path.mode} span="full" md={6}>
                  <ClickableCard
                    label={path.cta}
                    onClick={() => choose(path)}
                    padding={6}
                    height="100%"
                  >
                    <Stack gap={4} height="100%">
                      <Card variant="blue" padding={0} width={ICON_TILE} height={ICON_TILE}>
                        <Stack hAlign="center" vAlign="center" height="100%">
                          <Text color="accent">
                            <Glyph name={path.icon} />
                          </Text>
                        </Stack>
                      </Card>
                      <Stack gap={1}>
                        <Heading level={3}>{path.title}</Heading>
                        <Text color="secondary" display="block">
                          {path.description}
                        </Text>
                      </Stack>
                      <Stack gap={2}>
                        {path.points.map((point) => (
                          <HStack key={point} gap={2} vAlign="start">
                            <Text color="accent">
                              <Glyph name="check" />
                            </Text>
                            <Text type="supporting">{point}</Text>
                          </HStack>
                        ))}
                      </Stack>
                      <HStack gap={1.5} vAlign="center">
                        <Text weight="semibold" color="accent">
                          {path.cta}
                        </Text>
                        <Text color="accent">
                          <Glyph name="arrowRight" />
                        </Text>
                      </HStack>
                    </Stack>
                  </ClickableCard>
                </GridColumn>
              ))}
            </GridSystem>
          </Stack>
        </Stack>
      </Center>
    </Dialog>
  );
}
