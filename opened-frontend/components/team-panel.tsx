"use client";

import { useState } from "react";
import { Avatar, Badge, Button, Card, HStack, List, ListItem, Stack, TextInput } from "@openseat/design-system";
import { TEAM, type TeamMember } from "@/lib/account";

const ROLE_VARIANT = {
  Owner: "info",
  Admin: "neutral",
  Recruiter: "success",
  Viewer: "neutral",
} as const;

export function TeamPanel() {
  const [members, setMembers] = useState<TeamMember[]>(TEAM);
  const [email, setEmail] = useState("");

  return (
    <Stack gap={4}>
      <Card padding={2}>
        <List hasDividers>
          {members.map((member) => (
            <ListItem
              key={member.name}
              label={member.name}
              description={member.role}
              startContent={<Avatar name={member.name} tooltip={false} />}
              endContent={<Badge label={member.role} variant={ROLE_VARIANT[member.role]} />}
            />
          ))}
        </List>
      </Card>
      <HStack gap={2} vAlign="end" wrap="wrap">
        <TextInput label="Work email" value={email} onChange={setEmail} placeholder="name@company.com" width={320} />
        <Button
          label="Invite recruiter"
          variant="primary"
          isDisabled={email.trim().length === 0}
          onClick={() => {
            const name = email.trim();
            setMembers((current) => [...current, { name, role: "Recruiter" }]);
            setEmail("");
          }}
        />
      </HStack>
    </Stack>
  );
}
