import {
  Button,
  Grid,
  Heading,
  KpiWidget,
  MetadataList,
  MetadataListItem,
  PageHeader,
  Stack,
  Text,
} from "sid-ui";
import type { Meta } from "@joined/scout";
import { INSTALL_PAGE, ROUTES } from "@/lib/routes";
import { earnFigures } from "@/lib/site-copy";

const KPI_MIN_WIDTH = 180;
const KPI_MAX_COLUMNS = 3;

export function EarnView({ meta, signedIn }: { meta: Meta; signedIn: boolean }) {
  const earn = earnFigures(meta);
  return (
    <div className="sw-site">
      <PageHeader
        title="How scouts earn"
        description="A share of applies on jobs you submitted, then more when interviews and hires land."
        action={
          <Button
            label={signedIn ? "View earnings" : "Become a scout"}
            variant="primary"
            href={signedIn ? ROUTES.earnings : ROUTES.signUp}
          />
        }
      />
      <Grid columns={{ minWidth: KPI_MIN_WIDTH, max: KPI_MAX_COLUMNS }} gap={4}>
        <KpiWidget
          label="Per qualifying apply"
          value={earn.apply}
          hint="One credit per candidate per job."
        />
        <KpiWidget
          label="Interviews"
          value={earn.interviews}
          hint={`${earn.juniorLabel} to ${earn.seniorLabel}, by seniority.`}
        />
        <KpiWidget
          label="Hires"
          value={earn.hires}
          hint={`${earn.juniorLabel} to ${earn.seniorLabel}, when a hire is confirmed.`}
        />
      </Grid>
      <Stack gap={3}>
        <Heading level={2}>Share of applies</Heading>
        <Text color="secondary" display="block">
          When a candidate applies to a job that came from your approved submission, you earn{" "}
          {earn.apply}. The same person applying twice to the same job counts once.
        </Text>
      </Stack>
      <Stack gap={3}>
        <Heading level={2}>Interviews and hires</Heading>
        <MetadataList columns="single">
          {earn.interviewRows.map((row) => (
            <MetadataListItem key={row.seniority} label={`${row.label} role`}>
              {row.interview} per interview · {row.hire} per hire
            </MetadataListItem>
          ))}
          <MetadataListItem label="Company conversion">
            {earn.conversion} of that company&apos;s interview fees
          </MetadataListItem>
          <MetadataListItem label="Hold">
            {earn.holdDays} days on interview and hire rewards
          </MetadataListItem>
          <MetadataListItem label="Minimum payout">{earn.minPayout}</MetadataListItem>
        </MetadataList>
      </Stack>
      <div className="sw-cta-row">
        <Button label={INSTALL_PAGE.label} variant="secondary" href={INSTALL_PAGE.href} />
        <Button label="How it works" variant="ghost" href={ROUTES.howItWorks} />
      </div>
    </div>
  );
}
