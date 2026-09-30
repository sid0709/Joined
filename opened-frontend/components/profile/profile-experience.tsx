"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Divider,
  FormLayout,
  HStack,
  Heading,
  Glyph,
  Stack,
  Text,
  TextArea,
  TextInput,
  useToast,
} from "@openseat/design-system";
import { FormDialog } from "@/components/form-dialog";
import { SectionCard } from "@/components/section-card";
import { saveProfile } from "@/lib/me/pipeline";
import { normalizeProfile, type ExperienceItem, type Profile } from "@/lib/profile";

const LOGO_SIZE = 48;

function ExperienceRow({ item }: { item: ExperienceItem }) {
  return (
    <HStack gap={4} vAlign="start">
      <Avatar name={item.company} size={LOGO_SIZE} shape="rounded" tooltip={false} />
      <Stack gap={1}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Heading level={3}>{item.role}</Heading>
          {item.current ? <Badge label="Current" variant="blue" /> : null}
        </HStack>
        <Text color="secondary" display="block">
          {item.company} · {item.period}
        </Text>
        <Text display="block">{item.summary}</Text>
      </Stack>
    </HStack>
  );
}

/** Work history, newest first. */
export function ProfileExperience({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}) {
  const toast = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [period, setPeriod] = useState("");
  const [summary, setSummary] = useState("");

  const add = async () => {
    const next = normalizeProfile(
      await saveProfile({
        experience: [
          {
            id: "",
            role: role.trim(),
            company: company.trim(),
            period: period.trim(),
            summary: summary.trim(),
            current: /present/i.test(period),
          },
          ...profile.experience,
        ],
      }),
    );
    onSaved(next);
    setRole("");
    setCompany("");
    setPeriod("");
    setSummary("");
    setIsAdding(false);
    toast({ body: "Experience saved" });
  };

  return (
    <>
      <SectionCard
        title="Experience"
        description="Roles companies see when you apply."
        action={
          <Button
            label="Add role"
            variant="secondary"
            size="sm"
            icon={<Glyph name="plus" />}
            onClick={() => setIsAdding(true)}
          />
        }
      >
        <Stack gap={5}>
          {profile.experience.length === 0 ? (
            <Text color="secondary">No roles yet. Add the work you want companies to see.</Text>
          ) : (
            profile.experience.map((item, index) => (
              <Stack key={item.id} gap={5}>
                {index > 0 ? <Divider /> : null}
                <ExperienceRow item={item} />
              </Stack>
            ))
          )}
        </Stack>
      </SectionCard>
      <FormDialog
        isOpen={isAdding}
        onOpenChange={setIsAdding}
        title="Add a role"
        submitLabel="Save role"
        onSubmit={add}
        isSubmitDisabled={!role.trim() || !company.trim()}
      >
        <FormLayout>
          <TextInput label="Role" value={role} onChange={setRole} isRequired />
          <TextInput label="Company" value={company} onChange={setCompany} isRequired />
          <TextInput
            label="Period"
            value={period}
            onChange={setPeriod}
            placeholder="2022 — Present"
          />
          <TextArea label="Summary" value={summary} onChange={setSummary} rows={4} isOptional />
        </FormLayout>
      </FormDialog>
    </>
  );
}
