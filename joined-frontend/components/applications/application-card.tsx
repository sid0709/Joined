"use client";

import {
  Avatar,
  Badge,
  Card,
  HStack,
  Icon,
  IconButton,
  Stack,
  Text,
  icons,
} from "@joined/design-system";
import { STRONG_MATCH, type Application } from "@/lib/applications";
import { relativeDay } from "@/lib/dates";

const LOGO_SIZE = 32;

/** One application on the board: who, what, how good a fit, and what’s next. */
export function ApplicationCard({
  application,
  onOpen,
}: {
  application: Application;
  onOpen: () => void;
}) {
  return (
    <Card padding={4}>
      <Stack gap={3}>
        <HStack gap={3} vAlign="start">
          <Avatar name={application.company} size={LOGO_SIZE} shape="rounded" tooltip={false} />
          <Stack gap={0.5}>
            <Text weight="semibold" maxLines={1}>
              {application.title}
            </Text>
            <Text type="supporting" color="secondary" maxLines={1}>
              {application.company} · {application.location}
            </Text>
          </Stack>
        </HStack>

        <HStack gap={2} vAlign="center" wrap="wrap">
          <Badge
            label={`${application.match}% match`}
            variant={application.match >= STRONG_MATCH ? "success" : "neutral"}
          />
          {application.closedReason ? (
            <Badge label={application.closedReason} variant="neutral" />
          ) : null}
        </HStack>

        {application.nextStep ? (
          <HStack gap={2} vAlign="center">
            <Text color="accent">
              <Icon icon={icons.arrowRight} size="sm" color="inherit" />
            </Text>
            <Text type="supporting" maxLines={2}>
              {application.nextStep}
            </Text>
          </HStack>
        ) : null}

        <HStack hAlign="between" vAlign="center">
          <Text type="supporting" color="secondary">
            {relativeDay(application.updated)}
          </Text>
          <IconButton
            label={`Open ${application.title}`}
            icon={<Icon icon={icons.eye} />}
            variant="ghost"
            size="sm"
            onClick={onOpen}
          />
        </HStack>
      </Stack>
    </Card>
  );
}
