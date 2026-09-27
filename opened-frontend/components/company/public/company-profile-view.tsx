import {
  Badge,
  Card,
  ClickableCard,
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

/** The public company page: identity up top, open roles, and the facts that matter. */
export function CompanyProfileView({ company, jobs }: { company: PublicCompany; jobs: Job[] }) {
  const profile = presentCompany(company, jobs);
  const website = profile.url ? websiteHref(profile.url) : "";

  return (
    <Stack gap={6}>
      <Card padding={0} elevation="low">
        <Section variant="muted" dividers={["bottom"]} padding={8}>
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
                {profile.industry} · {profile.size} people · {profile.locations}
              </Text>
            </Stack>
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
        </HStack>
      </Card>

      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={8}>
          <Stack gap={4}>
            <Heading level={2}>Open roles</Heading>
            {jobs.length > 0 ? (
              jobs.map((job) => <RoleRow key={job.id} job={job} />)
            ) : (
              <Card padding={6}>
                <EmptyState
                  title="No open roles right now"
                  description={`${profile.name} isn’t hiring at the moment.`}
                />
              </Card>
            )}
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <Stack gap={6}>
            <SectionCard title={`About ${profile.name}`}>
              <Stack gap={4}>
                <Text display="block">{profile.about}</Text>
                <MetadataList>
                  <MetadataListItem label="Industry">{profile.industry}</MetadataListItem>
                  <MetadataListItem label="Size">{profile.size}</MetadataListItem>
                  <MetadataListItem label="Offices">{profile.locations}</MetadataListItem>
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
            {profile.perks.length > 0 ? (
              <SectionCard title="Perks">
                <HStack gap={2} wrap="wrap">
                  {profile.perks.map((perk) => (
                    <Token key={perk} label={perk} size="sm" />
                  ))}
                </HStack>
              </SectionCard>
            ) : null}
          </Stack>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
