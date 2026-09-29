"use client";

import {
  Avatar,
  Badge,
  Card,
  HStack,
  Icon,
  IconButton,
  Rating,
  Stack,
  Text,
  icons,
} from "@openseat/design-system";
import { STRONG_FIT, type Applicant } from "@/lib/company";
import { relativeDay } from "@/lib/dates";

const AVATAR_SIZE = 36;

/** A candidate on the board: who, which job, how strong, how they applied. */
export function ApplicantCard({ applicant, onOpen }: { applicant: Applicant; onOpen: () => void }) {
  return (
    <Card padding={4}>
      <Stack gap={3}>
        <HStack gap={3} vAlign="center">
          <Avatar name={applicant.name} size={AVATAR_SIZE} tooltip={false} />
          <Stack gap={0}>
            <Text weight="semibold" maxLines={1}>
              {applicant.name}
            </Text>
            <Text type="supporting" color="secondary" maxLines={1}>
              {applicant.jobTitle}
            </Text>
          </Stack>
        </HStack>

        <HStack gap={1.5} wrap="wrap">
          <Badge
            label={`${applicant.fit}% fit`}
            variant={applicant.fit >= STRONG_FIT ? "success" : "neutral"}
          />
          {applicant.verified ? (
            <Badge label="Verified" variant="blue" />
          ) : (
            <Badge label="Unverified" variant="warning" />
          )}
          {applicant.assisted !== "direct" ? <Badge label="Assisted" variant="purple" /> : null}
          {(applicant.tags ?? []).slice(0, 2).map((tag) => (
            <Badge key={tag} label={tag} variant="neutral" />
          ))}
        </HStack>

        <HStack hAlign="between" vAlign="center">
          {applicant.rating ? (
            <Rating
              value={applicant.rating}
              readOnly
              size="sm"
              showValue={false}
              label="Team rating"
            />
          ) : (
            <Text type="supporting" color="secondary">
              Applied {relativeDay(applicant.appliedOn).toLowerCase()}
            </Text>
          )}
          <IconButton
            label={`Open ${applicant.name}`}
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
