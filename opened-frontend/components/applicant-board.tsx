"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  GridColumn,
  GridSystem,
  HStack,
  Heading,
  List,
  ListItem,
  Stack,
  Text,
} from "@openseat/design-system";
import { APPLICANTS, type Applicant } from "@/lib/account";

const FIT_STRONG = 85;

export function ApplicantBoard() {
  const [selectedId, setSelectedId] = useState(APPLICANTS[0].id);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const selected = APPLICANTS.find((person) => person.id === selectedId) ?? APPLICANTS[0];

  const mark = (person: Applicant, action: string) => {
    setNotes((current) => ({ ...current, [person.id]: action }));
  };

  return (
    <GridSystem gap={4}>
      <GridColumn span={12} lg={5}>
        <Card padding={2}>
          <List>
            {APPLICANTS.map((person) => (
              <ListItem
                key={person.id}
                label={person.name}
                description={`${person.jobTitle} · ${person.fit}% fit`}
                isSelected={person.id === selected.id}
                onClick={() => setSelectedId(person.id)}
                startContent={<Avatar name={person.name} size="sm" tooltip={false} />}
              />
            ))}
          </List>
        </Card>
      </GridColumn>
      <GridColumn span={12} lg={7}>
        <Card>
          <Stack gap={3}>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
              <Stack gap={1}>
                <Heading level={2}>{selected.name}</Heading>
                <Text color="secondary">
                  {selected.role} · {selected.jobTitle}
                </Text>
              </Stack>
              <Badge label={`${selected.fit}% fit`} variant={selected.fit >= FIT_STRONG ? "success" : "neutral"} />
            </HStack>
            <HStack gap={2} wrap="wrap">
              <Badge label={selected.verified ? "Verified" : "Unverified"} variant={selected.verified ? "success" : "warning"} />
              <Badge label={selected.assisted === "No" ? "Direct" : selected.assisted} variant={selected.assisted === "No" ? "neutral" : "info"} />
              <Badge label={`Resume · ${selected.resume}`} variant="neutral" />
            </HStack>
            <Text display="block">
              Contact details stay hidden until you schedule an interview. “Not relevant” is only for assisted applications.
            </Text>
            <HStack gap={2} wrap="wrap">
              <Button label="Shortlist" variant="primary" onClick={() => mark(selected, "Shortlisted")} />
              <Button label="Schedule interview" variant="secondary" onClick={() => mark(selected, "Scheduling opened")} />
              <Button label="Reject" variant="ghost" onClick={() => mark(selected, "Rejected")} />
              {selected.assisted !== "No" ? (
                <Button label="Not relevant" variant="ghost" onClick={() => mark(selected, "Marked not relevant")} />
              ) : null}
            </HStack>
            {notes[selected.id] ? (
              <Text type="supporting" color="secondary">
                {notes[selected.id]} on this page.
              </Text>
            ) : null}
          </Stack>
        </Card>
      </GridColumn>
    </GridSystem>
  );
}
