import {
  Button,
  Card,
  Glyph,
  HStack,
  Heading,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
} from "@openseat/design-system";
import { formatCount, jobsForCompany, type CompanyProfile } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";
import { CompanyLogo } from "./company-logo";

/** The employer at a glance: what they do, how big, how fast they reply. */
export function CompanyCard({ company }: { company: CompanyProfile }) {
  const openRoles = jobsForCompany(company.slug).length;

  return (
    <Card padding={5}>
      <Stack gap={4}>
        <HStack gap={3} vAlign="center">
          <CompanyLogo name={company.name} size={40} />
          <Stack gap={0}>
            <Heading level={3}>About {company.name}</Heading>
            <Text type="supporting" color="secondary">
              {company.industry} · {company.locations}
            </Text>
          </Stack>
        </HStack>
        <Text display="block">{company.about}</Text>
        <MetadataList columns="multi">
          <MetadataListItem label="Company size" icon={<Glyph name="users" />}>
            {company.size}
          </MetadataListItem>
          <MetadataListItem label="Founded" icon={<Glyph name="calendar" />}>
            {company.founded}
          </MetadataListItem>
          <MetadataListItem label="Replies in" icon={<Glyph name="clock" />}>
            ~{formatCount(company.replyDays, "day")}
          </MetadataListItem>
        </MetadataList>
        <HStack>
          <Button
            label={`See ${formatCount(openRoles, "open role")}`}
            variant="secondary"
            size="sm"
            href={ROUTES.companyPublic(company.slug)}
            icon={<Glyph name="arrowRight" />}
          />
        </HStack>
      </Stack>
    </Card>
  );
}
