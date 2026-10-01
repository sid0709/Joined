import type { ReactNode } from "react";
import {
  Badge,
  Blockquote,
  Button,
  Card,
  Divider,
  Glyph,
  GridColumn,
  GridSystem,
  HStack,
  Heading,
  Link,
  MetadataList,
  MetadataListItem,
  Section,
  Skeleton,
  Stack,
  Text,
  Token,
} from "@openseat/design-system";
import { companySizeLabel } from "@openseat/job-schema";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { SectionCard } from "@/components/section-card";
import {
  presentCompany,
  websiteHref,
  websiteLabel,
  type Job,
  type PublicCompany,
} from "@/lib/jobs";
import { CompanyCareers } from "@/components/company/public/company-careers";

const LOGO_SIZE = 96;

/** A single stat's value: the real figure, or a skeleton while the field is unset. */
function StatValue({ value }: { value?: ReactNode }) {
  return value != null && value !== "" ? (
    <Text weight="semibold">{value}</Text>
  ) : (
    <Skeleton width={48} height={18} />
  );
}

/** `count` lines of skeleton text, standing in for a paragraph or list not on file yet. */
function SkeletonLines({
  count,
  lastWidth = "70%",
}: {
  count: number;
  lastWidth?: number | string;
}) {
  return (
    <Stack gap={2}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          height={14}
          width={index === count - 1 ? lastWidth : "100%"}
          index={index}
        />
      ))}
    </Stack>
  );
}

function SkeletonTokens({ count = 3 }: { count?: number }) {
  return (
    <HStack gap={2} wrap="wrap">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} width={72 + index * 16} height={28} radius="rounded" index={index} />
      ))}
    </HStack>
  );
}

/** The public company page: identity up top, open roles, and the facts that matter. */
export function CompanyProfileView({
  company,
  jobs,
  allJobs,
  companyId,
  departmentFilter = "",
  locationFilter = "",
}: {
  company: PublicCompany;
  /** Open roles after optional ?department=&location= BE filters. */
  jobs: Job[];
  /** Unfiltered open roles for careers facet chips. */
  allJobs?: Job[];
  companyId?: string;
  departmentFilter?: string;
  locationFilter?: string;
}) {
  const facetJobs = allJobs ?? jobs;
  const profile = presentCompany(company, facetJobs);
  const website = profile.url ? websiteHref(profile.url) : "";
  const hasValues = profile.values != null && profile.values.length > 0;
  const hasBenefits = profile.benefitCategories != null && profile.benefitCategories.length > 0;

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
                hasFile={profile.hasLogoFile}
                size={LOGO_SIZE}
              />
              <Stack gap={2}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Heading level={1}>{profile.name}</Heading>
                  <Badge label="Verified employer" variant="info" icon={<Glyph name="check" />} />
                </HStack>
                {profile.tagline ? (
                  <Text type="large" color="secondary" display="block">
                    {profile.tagline}
                  </Text>
                ) : null}
                {profile.industry || profile.companyType || profile.size ? (
                  <Text color="secondary" display="block">
                    {[
                      profile.industry,
                      profile.companyType,
                      profile.size ? companySizeLabel(profile.size) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                ) : (
                  <Skeleton width={260} height={16} />
                )}
                {profile.headquarters || profile.locations ? (
                  <Text color="secondary" display="block">
                    {[profile.headquarters, profile.locations].filter(Boolean).join(" · ")}
                  </Text>
                ) : (
                  <Skeleton width={200} height={16} />
                )}
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
            <StatValue value={profile.replyDays ? `~${profile.replyDays}d` : undefined} />
          </Stack>
          <Stack gap={0.5}>
            <Text type="supporting" color="secondary">
              Founded
            </Text>
            <StatValue value={profile.founded} />
          </Stack>
          <Stack gap={0.5}>
            <Text type="supporting" color="secondary">
              Headquarters
            </Text>
            <StatValue value={profile.headquarters} />
          </Stack>
        </HStack>
      </Card>

      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={8}>
          <Stack gap={6}>
            <SectionCard title="Mission" description={`Why ${profile.name} exists`}>
              {profile.mission ? (
                <Blockquote cite={`— ${profile.name} team`}>{profile.mission}</Blockquote>
              ) : (
                <SkeletonLines count={2} />
              )}
            </SectionCard>

            <SectionCard title="Values & culture">
              {hasValues ? (
                <GridSystem gap={4}>
                  {profile.values?.map((value) => (
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
              ) : (
                <GridSystem gap={4}>
                  {[0, 1, 2].map((index) => (
                    <GridColumn key={index} span="full" md={4}>
                      <Stack gap={2}>
                        <Skeleton width={24} height={24} radius="rounded" index={index} />
                        <Skeleton width="60%" height={16} index={index} />
                        <SkeletonLines count={1} />
                      </Stack>
                    </GridColumn>
                  ))}
                </GridSystem>
              )}
            </SectionCard>

            <CompanyCareers
              companyId={companyId ?? company.id}
              companyName={profile.name}
              jobs={jobs}
              allJobs={facetJobs}
              departmentFilter={departmentFilter}
              locationFilter={locationFilter}
            />
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <Stack gap={6}>
            <SectionCard title={`About ${profile.name}`}>
              <Stack gap={4}>
                <Text display="block">{profile.about}</Text>
                <MetadataList>
                  <MetadataListItem label="Industry">
                    <StatValue value={profile.industry} />
                  </MetadataListItem>
                  <MetadataListItem label="Company type">
                    <StatValue value={profile.companyType} />
                  </MetadataListItem>
                  <MetadataListItem label="Size">
                    <StatValue value={profile.size} />
                  </MetadataListItem>
                  <MetadataListItem label="Headquarters">
                    <StatValue value={profile.headquarters} />
                  </MetadataListItem>
                  <MetadataListItem label="Offices">
                    <StatValue value={profile.locations} />
                  </MetadataListItem>
                  <MetadataListItem label="Founded">
                    <StatValue value={profile.founded} />
                  </MetadataListItem>
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

            <SectionCard title="Specialties">
              {profile.specialties && profile.specialties.length > 0 ? (
                <HStack gap={2} wrap="wrap">
                  {profile.specialties.map((specialty) => (
                    <Token key={specialty} label={specialty} size="sm" color="blue" />
                  ))}
                </HStack>
              ) : (
                <SkeletonTokens />
              )}
            </SectionCard>

            <SectionCard title="Benefits & Perks">
              {hasBenefits ? (
                <Stack gap={4}>
                  {profile.benefitCategories?.map((category, index) => (
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
              ) : (
                <Stack gap={4}>
                  {[0, 1].map((index) => (
                    <Stack gap={2} key={index}>
                      {index > 0 ? <Divider /> : null}
                      <Skeleton width={110} height={14} index={index} />
                      <SkeletonLines count={2} />
                    </Stack>
                  ))}
                </Stack>
              )}
            </SectionCard>
          </Stack>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
