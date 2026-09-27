import {
  Avatar,
  AvatarGroup,
  Badge,
  Blockquote,
  Button,
  Card,
  ClickableCard,
  Divider,
  EmptyState,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  Heading,
  Link,
  MetadataList,
  MetadataListItem,
  Section,
  Stack,
  Text,
  Timeline,
  Token,
} from "@openseat/design-system";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { JobTags } from "@/components/jobs/job-tags";
import { SectionCard } from "@/components/section-card";
import {
  formatCount,
  formatPay,
  formatPosted,
  presentCompany,
  websiteHref,
  websiteLabel,
  type Job,
  type PublicCompany,
} from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";

const LOGO_SIZE = 96;
const ROLE_LOGO_SIZE = 40;
const HIRING_STAGES = ["Applied", "Screen", "Interview", "Offer"] as const;

function RoleRow({ job }: { job: Job }) {
  return (
    <ClickableCard label={`${job.title} at ${job.company}`} href={ROUTES.job(job.id)} padding={4}>
      <HStack gap={3} vAlign="start">
        <CompanyLogo
          name={job.company}
          companyId={job.companyId}
          src={job.companyLogo}
          size={ROLE_LOGO_SIZE}
        />
        <Stack gap={2}>
          <Stack gap={0.5}>
            <Text weight="semibold">{job.title}</Text>
            <Text type="supporting" color="secondary">
              {job.team ? `${job.team} · ` : ""}
              {job.location} · {formatPosted(job.postedHoursAgo)}
            </Text>
          </Stack>
          <JobTags job={job} applied={false} />
          <Text weight="medium" hasTabularNumbers>
            {formatPay(job.pay)}
          </Text>
        </Stack>
      </HStack>
    </ClickableCard>
  );
}

function hiringTimeline(replyDays: number) {
  const offsets = [0, 1, Math.max(2, Math.round(replyDays / 2)), replyDays + 3];
  return HIRING_STAGES.map((stage, index) => ({
    id: stage,
    title: stage,
    time: index === 0 ? "Day 0" : `~Day ${offsets[index]}`,
    status: (index === 0 ? "done" : "upcoming") as "done" | "upcoming",
  }));
}

/** The public company page: identity up top, open roles, and the facts that matter. */
export function CompanyProfileView({ company, jobs }: { company: PublicCompany; jobs: Job[] }) {
  const profile = presentCompany(company, jobs);
  const website = profile.url ? websiteHref(profile.url) : "";

  return (
    <Stack gap={6}>
      <Card padding={0} elevation="low">
        <Section variant="muted" dividers={["bottom"]} padding={8}>
          <HStack gap={5} vAlign="center" wrap="wrap" hAlign="between">
            <HStack gap={5} vAlign="center" wrap="wrap">
              <CompanyLogo
                name={profile.name}
                companyId={profile.id}
                src={profile.logo}
                size={LOGO_SIZE}
              />
              <Stack gap={2}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Heading level={1}>{profile.name}</Heading>
                  {profile.verified ? (
                    <Badge label="Verified employer" variant="info" icon={<Glyph name="check" />} />
                  ) : null}
                </HStack>
                {profile.tagline ? (
                  <Text type="large" color="secondary" display="block">
                    {profile.tagline}
                  </Text>
                ) : null}
                <Text color="secondary" display="block">
                  {profile.industry} · {profile.companyType} · {profile.size} people
                </Text>
                <Text color="secondary" display="block">
                  {profile.headquarters} · {profile.locations}
                </Text>
              </Stack>
            </HStack>
            {website ? (
              <Button label="Visit website" href={website} target="_blank" variant="secondary" />
            ) : null}
          </HStack>
        </Section>
        <HStack gap={6} padding={5} paddingInline={8} wrap="wrap">
          <Stack gap={0.5}>
            <Text type="supporting" color="secondary">
              Open roles
            </Text>
            <Text weight="semibold">{jobs.length}</Text>
          </Stack>
          <Stack gap={0.5}>
            <Text type="supporting" color="secondary">
              Replies in
            </Text>
            <Text weight="semibold">~{formatCount(profile.replyDays, "day")}</Text>
          </Stack>
          <Stack gap={0.5}>
            <Text type="supporting" color="secondary">
              Founded
            </Text>
            <Text weight="semibold">{profile.founded}</Text>
          </Stack>
          <Stack gap={0.5}>
            <Text type="supporting" color="secondary">
              Headquarters
            </Text>
            <Text weight="semibold">{profile.headquarters}</Text>
          </Stack>
        </HStack>
      </Card>

      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={8}>
          <Stack gap={6}>
            <SectionCard title="Mission" description={`Why ${profile.name} exists`}>
              <Blockquote cite={`— ${profile.name} team`}>{profile.mission}</Blockquote>
            </SectionCard>

            <SectionCard title="Values & culture">
              <GridSystem gap={4}>
                {profile.values.map((value) => (
                  <GridColumn key={value.title} span="full" md={4}>
                    <Stack gap={2}>
                      <HStack gap={2} vAlign="center">
                        <Glyph name={value.icon} />
                        <Text weight="semibold">{value.title}</Text>
                      </HStack>
                      <Text type="supporting" color="secondary" display="block">
                        {value.description}
                      </Text>
                    </Stack>
                  </GridColumn>
                ))}
              </GridSystem>
            </SectionCard>

            <SectionCard
              title="Open roles"
              description={`${jobs.length} open at ${profile.name} right now`}
            >
              <Stack gap={4}>
                {jobs.length > 0 ? (
                  jobs.map((job) => <RoleRow key={job.id} job={job} />)
                ) : (
                  <EmptyState
                    title="No open roles right now"
                    description={`${profile.name} isn’t hiring at the moment.`}
                  />
                )}
              </Stack>
            </SectionCard>

            <SectionCard
              title="What to expect when you apply"
              description={`Typical hiring process at ${profile.name}`}
            >
              <Timeline
                variant="horizontal"
                label="Hiring process"
                items={hiringTimeline(profile.replyDays)}
              />
            </SectionCard>
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <Stack gap={6}>
            <SectionCard title={`About ${profile.name}`}>
              <Stack gap={4}>
                <Text display="block">{profile.about}</Text>
                <MetadataList>
                  <MetadataListItem label="Industry">{profile.industry}</MetadataListItem>
                  <MetadataListItem label="Company type">{profile.companyType}</MetadataListItem>
                  <MetadataListItem label="Size">{profile.size}</MetadataListItem>
                  <MetadataListItem label="Headquarters">{profile.headquarters}</MetadataListItem>
                  <MetadataListItem label="Offices">{profile.locations}</MetadataListItem>
                  <MetadataListItem label="Founded">{profile.founded}</MetadataListItem>
                  {website ? (
                    <MetadataListItem label="Website">
                      <Link href={website} target="_blank">
                        {websiteLabel(profile.url ?? "")}
                      </Link>
                    </MetadataListItem>
                  ) : null}
                </MetadataList>
              </Stack>
            </SectionCard>

            {profile.specialties.length > 0 ? (
              <SectionCard title="Specialties">
                <HStack gap={2} wrap="wrap">
                  {profile.specialties.map((specialty) => (
                    <Token key={specialty} label={specialty} size="sm" color="blue" />
                  ))}
                </HStack>
              </SectionCard>
            ) : null}

            {profile.techStack.length > 0 ? (
              <SectionCard title="Tech stack">
                <HStack gap={2} wrap="wrap">
                  {profile.techStack.map((tech) => (
                    <Token key={tech} label={tech} size="sm" />
                  ))}
                </HStack>
              </SectionCard>
            ) : null}

            <SectionCard title="Leadership">
              <Stack gap={4}>
                <AvatarGroup size="md">
                  {profile.leadership.map((leader) => (
                    <Avatar
                      key={leader.name}
                      name={leader.name}
                      tooltip={`${leader.name}, ${leader.title}`}
                    />
                  ))}
                </AvatarGroup>
                <Stack gap={3}>
                  {profile.leadership.map((leader) => (
                    <HStack key={leader.name} gap={3} vAlign="center">
                      <Avatar name={leader.name} size="sm" />
                      <Stack gap={0}>
                        <Text weight="medium">{leader.name}</Text>
                        <Text type="supporting" color="secondary">
                          {leader.title}
                        </Text>
                      </Stack>
                    </HStack>
                  ))}
                </Stack>
              </Stack>
            </SectionCard>

            {profile.perks.length > 0 ? (
              <SectionCard title="Perks">
                <HStack gap={2} wrap="wrap">
                  {profile.perks.map((perk) => (
                    <Token key={perk} label={perk} size="sm" />
                  ))}
                </HStack>
              </SectionCard>
            ) : null}

            <SectionCard title="Benefits">
              <Stack gap={4}>
                {profile.benefitCategories.map((category, index) => (
                  <Stack gap={2} key={category.label}>
                    {index > 0 ? <Divider /> : null}
                    <Text weight="semibold">{category.label}</Text>
                    <Stack gap={1}>
                      {category.items.map((item) => (
                        <Text key={item} type="supporting" color="secondary" display="block">
                          {item}
                        </Text>
                      ))}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </SectionCard>
          </Stack>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
