"use client";

import { Heading, Icon, Link, Stack, Text, icons } from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const FOOTER = [
  { title: "Product", links: ["Rooms", "Bidding", "Pricing"] },
  { title: "Company", links: ["About", "Careers", "Press"] },
  { title: "Help", links: ["Docs", "Status", "Contact"] },
];

export default function LinkDemo() {
  return (
    <Examples>
      <Preview align="start" label="Inline" description="Links navigate. For actions, use a Button.">
        <Text>
          Sealed rooms keep bids private until you choose. Read <Link href="#rooms">how rooms work</Link> or see the{" "}
          <Link href="#pricing">pricing</Link> before you post.
        </Text>
      </Preview>

      <Preview align="start" label="Standalone" description="isStandalone for links that sit on their own, outside a sentence.">
        <Stack gap={2} hAlign="start">
          <Link href="#all-rooms" isStandalone>
            View all rooms
          </Link>
          <Link href="#new" isStandalone weight="semibold">
            Post a sealed room
          </Link>
          <Link href="#help" isStandalone color="secondary">
            Need help?
          </Link>
        </Stack>
      </Preview>

      <Preview align="start" label="Underline">
        <Row>
          <Link href="#terms" hasUnderline isStandalone>
            Terms of service
          </Link>
          <Link href="#privacy" hasUnderline isStandalone>
            Privacy policy
          </Link>
        </Row>
      </Preview>

      <Preview align="start" label="External" description="Opens in a new tab and says so to screen readers.">
        <Stack gap={2} hAlign="start">
          <Link href="https://astryx.atmeta.com/" isExternalLink isStandalone>
            Astryx design system
          </Link>
          <Link href="https://react.dev/" isExternalLink isStandalone newTabLabel="(new window)">
            React documentation
          </Link>
        </Stack>
      </Preview>

      <Preview align="start" label="Sizes and weights">
        <Stack gap={2} hAlign="start">
          <Link href="#sm" isStandalone type="supporting">
            Supporting size
          </Link>
          <Link href="#body" isStandalone>
            Body size
          </Link>
          <Link href="#large" isStandalone type="large" weight="semibold">
            Large, semibold
          </Link>
        </Stack>
      </Preview>

      <Preview align="start" label="Tooltip, download, disabled">
        <Row>
          <Link href="#settings" tooltip="Account and notifications" isStandalone>
            Settings
          </Link>
          <Link href="#" download="brief.pdf" isStandalone>
            Download brief
          </Link>
          <Link href="#locked" isDisabled isStandalone>
            Archived room
          </Link>
        </Row>
      </Preview>

      <Preview align="start" label="Pattern — breadcrumb trail">
        <Row>
          <Link href="#home" isStandalone color="secondary">
            Home
          </Link>
          <Icon icon={icons.chevronRight} size="sm" color="secondary" />
          <Link href="#rooms" isStandalone color="secondary">
            Rooms
          </Link>
          <Icon icon={icons.chevronRight} size="sm" color="secondary" />
          <Text weight="medium">Brand refresh</Text>
        </Row>
      </Preview>

      <Preview align="start" label="Pattern — footer columns">
        <Row>
          {FOOTER.map((column) => (
            <Stack key={column.title} gap={2} width={160}>
              <Heading level={4}>{column.title}</Heading>
              {column.links.map((label) => (
                <Link key={label} href={`#${label.toLowerCase()}`} isStandalone color="secondary">
                  {label}
                </Link>
              ))}
            </Stack>
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Pattern — helper copy">
        <Caption>
          Didn’t get the invite? <Link href="#resend">Resend it</Link> or <Link href="#support">contact support</Link>.
        </Caption>
      </Preview>
    </Examples>
  );
}
