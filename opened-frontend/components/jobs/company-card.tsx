import {
  Badge,
  Button,
  Card,
  Glyph,
  Grid,
  HStack,
  Heading,
  Section,
  Stack,
  Text,
  Token,
  type GlyphName,
} from "@openseat/design-system";
import { formatCount, jobsForCompany, type CompanyProfile } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";
import { CompanyLogo } from "./company-logo";

const LOGO_SIZE = 48;
const FACT_COLUMNS = 3;
const FACT_MIN_WIDTH = 96;
const ABOUT_LINES = 4;

/** Extras a company can add on its page; job pages work without them. */
export type CompanyCardExtras = {
  tagline?: string;
  perks?: string[];
  verified?: boolean;
  logo?: string;
  id?: string;
};

function Fact({ icon, label, value }: { icon: GlyphName; label: string; value: string }) {
  return (
    <Card variant="muted" padding={3}>
      <Stack gap={1}>
        <HStack gap={1.5} vAlign="center">
          <Text color="secondary">
            <Glyph name={icon} />
          </Text>
          <Text type="supporting" color="secondary">
            {label}
          </Text>
        </HStack>
        <Text weight="semibold">{value}</Text>
      </Stack>
    </Card>
  );
}

/** The employer at a glance: identity, what they do, three facts, and their open roles. */
export function CompanyCard({
  company,
  openRoles,
  hasActions = true,
}: {
  company: CompanyProfile & CompanyCardExtras;
  openRoles?: number;
  hasActions?: boolean;
}) {
  const roles = openRoles ?? jobsForCompany(company.slug).length;
  const companyId = company.id || company.slug;

  return (
    <Card padding={0}>
      <Section variant="muted" dividers={["bottom"]} padding={5}>
        <HStack gap={3} vAlign="center">
          <CompanyLogo
            name={company.name}
            companyId={companyId}
            src={company.logo}
            size={LOGO_SIZE}
          />
          <Stack gap={0.5}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Heading level={3}>{company.name}</Heading>
              {company.verified ? (
                <Badge label="Verified" variant="blue" icon={<Glyph name="check" />} />
              ) : null}
            </HStack>
            <Text type="supporting" color="secondary">
              {company.industry} · {company.locations}
            </Text>
          </Stack>
        </HStack>
      </Section>

      <Stack gap={4} padding={5}>
        {company.tagline ? (
          <Text weight="semibold" display="block">
            {company.tagline}
          </Text>
        ) : null}
        <Text color="secondary" display="block" maxLines={ABOUT_LINES}>
          {company.about}
        </Text>

        <Grid columns={{ minWidth: FACT_MIN_WIDTH, max: FACT_COLUMNS }} gap={2}>
          <Fact icon="users" label="Size" value={company.size} />
          <Fact icon="calendar" label="Founded" value={String(company.founded)} />
          <Fact
            icon="clock"
            label="Replies in"
            value={`~${formatCount(company.replyDays, "day")}`}
          />
        </Grid>

        {company.perks && company.perks.length > 0 ? (
          <HStack gap={2} wrap="wrap">
            {company.perks.map((perk) => (
              <Token key={perk} label={perk} size="sm" />
            ))}
          </HStack>
        ) : null}

        {hasActions ? (
          <HStack gap={2} wrap="wrap">
            <Button
              label={`See ${formatCount(roles, "open role")}`}
              variant="secondary"
              size="sm"
              href={ROUTES.companyPublic(companyId)}
              icon={<Glyph name="arrowRight" />}
            />
          </HStack>
        ) : null}
      </Stack>
    </Card>
  );
}
