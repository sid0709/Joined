import { Banner, Button, Card, Heading, PageHeader, Stack, Text } from "@joined/design-system";
import { EARN_PAGE, FAQ_PAGE, ROUTES } from "@/lib/routes";
import { INSTALL_PLACEHOLDER_BODY, INSTALL_PLACEHOLDER_TITLE } from "@/lib/site-copy";

const STEPS = [
  {
    title: "Add Scout to Chrome",
    body: "Use the store listing when it is live. Until then, this page stays as a placeholder.",
  },
  {
    title: "Pin the extension",
    body: "Keep Scout in the toolbar so you can open the side panel on a careers page.",
  },
  {
    title: "Sign in from the extension",
    body: "The extension opens a Scout tab. Sign in, then close that tab and return to the panel.",
  },
] as const;

export function InstallView({ storeUrl }: { storeUrl: string }) {
  const listingReady = Boolean(storeUrl);
  return (
    <div className="sw-site">
      <PageHeader
        title="Install the Scout extension"
        description="Capture official openings as you browse company careers pages."
        action={
          listingReady ? (
            <Button
              label="Add to Chrome"
              variant="primary"
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
            />
          ) : null
        }
      />
      {listingReady ? null : (
        <Banner
          status="info"
          title={INSTALL_PLACEHOLDER_TITLE}
          description={INSTALL_PLACEHOLDER_BODY}
        />
      )}
      <Stack gap={4}>
        {STEPS.map((step, index) => (
          <Card key={step.title} padding={6}>
            <Stack gap={2}>
              <Text type="supporting" color="secondary">
                Step {index + 1}
              </Text>
              <Heading level={2}>{step.title}</Heading>
              <Text color="secondary" display="block">
                {step.body}
              </Text>
            </Stack>
          </Card>
        ))}
      </Stack>
      <div className="sw-cta-row">
        <Button label="Become a scout" variant="primary" href={ROUTES.signUp} />
        <Button label={EARN_PAGE.label} variant="secondary" href={EARN_PAGE.href} />
        <Button label={FAQ_PAGE.label} variant="ghost" href={FAQ_PAGE.href} />
      </div>
    </div>
  );
}
