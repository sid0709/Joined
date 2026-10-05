import { Button, Heading, PageHeader, Stack, Text } from "sid-ui";
import type { Meta } from "@joined/scout";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LevelTiers } from "@/components/landing/level-tiers";
import { EARN_PAGE, INSTALL_PAGE, ROUTES } from "@/lib/routes";

export function HowItWorksView({ meta }: { meta: Meta }) {
  return (
    <div className="sw-site">
      <PageHeader
        title="How Scout works"
        description="Find official openings, submit them once, and earn when job hunters actually use them."
      />
      <Stack gap={4}>
        <Heading level={2}>What Scout is</Heading>
        <Text color="secondary" display="block">
          Scout is Joined&apos;s sourcing channel. You add real apply links from company careers
          pages and applicant tracking systems. Joined checks each link, puts clean jobs in the
          pool, and pays you when candidates apply, interview, or get hired through them.
        </Text>
      </Stack>
      <HowItWorks meta={meta} />
      <LevelTiers meta={meta} />
      <div className="sw-cta-row">
        <Button label={INSTALL_PAGE.label} variant="primary" href={INSTALL_PAGE.href} />
        <Button label={EARN_PAGE.label} variant="secondary" href={EARN_PAGE.href} />
        <Button label="Become a scout" variant="ghost" href={ROUTES.signUp} />
      </div>
    </div>
  );
}
