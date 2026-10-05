import type { ReactNode } from "react";
import { Divider, Heading, HStack, Stack, Text, Token } from "sid-ui";
import type { EducationItem, ExperienceItem, Profile } from "@/lib/profile";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={3}>
      <Heading level={3}>{title}</Heading>
      {children}
    </Stack>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <Text type="supporting" color="secondary" display="block">
      {label}
    </Text>
  );
}

function Role({ item }: { item: ExperienceItem }) {
  const heading = [item.role.trim(), item.company.trim()].filter(Boolean).join(" · ");
  return (
    <Stack gap={1}>
      <Text weight="semibold" display="block">
        {heading || "Role"}
      </Text>
      {item.period.trim() ? (
        <Text type="supporting" color="secondary" display="block">
          {item.period}
        </Text>
      ) : null}
      {item.summary.trim() ? <Text display="block">{item.summary}</Text> : null}
    </Stack>
  );
}

function School({ item }: { item: EducationItem }) {
  const detail = [item.degree.trim(), item.field.trim()].filter(Boolean).join(", ");
  return (
    <Stack gap={1}>
      <Text weight="semibold" display="block">
        {item.school.trim() || "School"}
      </Text>
      {detail || item.period.trim() ? (
        <Text type="supporting" color="secondary" display="block">
          {[detail, item.period.trim()].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      {item.summary.trim() ? <Text display="block">{item.summary}</Text> : null}
    </Stack>
  );
}

/** Live first page of the structured résumé saved on the profile. */
export function ResumeDocument({ profile }: { profile: Profile }) {
  const contact = [profile.email, profile.phone, profile.location]
    .map((part) => part.trim())
    .filter(Boolean);
  const links = [profile.links.linkedin, profile.links.github, profile.links.portfolio]
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <Stack gap={5}>
      <Stack gap={1}>
        <Heading level={2}>{profile.name.trim() || "Your name"}</Heading>
        {profile.headline.trim() ? (
          <Text type="large" color="secondary" display="block">
            {profile.headline}
          </Text>
        ) : (
          <Empty label="Add a headline" />
        )}
        {contact.length > 0 ? (
          <Text type="supporting" color="secondary" display="block">
            {contact.join(" · ")}
          </Text>
        ) : (
          <Empty label="Add email, phone, or location" />
        )}
        {links.length > 0 ? (
          <Text type="supporting" color="secondary" display="block">
            {links.join(" · ")}
          </Text>
        ) : null}
      </Stack>

      <Divider />

      <Section title="Summary">
        {profile.about.trim() ? (
          <Text display="block">{profile.about}</Text>
        ) : (
          <Empty label="Add a short summary" />
        )}
      </Section>

      <Section title="Experience">
        {profile.experience.length > 0 ? (
          <Stack gap={4}>
            {profile.experience.map((item) => (
              <Role key={item.id || `${item.role}-${item.company}`} item={item} />
            ))}
          </Stack>
        ) : (
          <Empty label="Add a role" />
        )}
      </Section>

      <Section title="Education">
        {profile.education.length > 0 ? (
          <Stack gap={4}>
            {profile.education.map((item) => (
              <School key={item.id || `${item.school}-${item.degree}`} item={item} />
            ))}
          </Stack>
        ) : (
          <Empty label="Add a school" />
        )}
      </Section>

      <Section title="Skills">
        {profile.skills.length > 0 ? (
          <HStack gap={2} wrap="wrap">
            {profile.skills.map((skill) => (
              <Token key={skill} label={skill} size="sm" />
            ))}
          </HStack>
        ) : (
          <Empty label="Add skills" />
        )}
      </Section>
    </Stack>
  );
}
