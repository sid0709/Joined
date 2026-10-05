"use client";

import { Badge, BrandHeading, Stack, TopNav, TopNavItem } from "sid-ui";

import { Examples, Preview } from "./shared";

export default function BrandHeadingDemo() {
  return (
    <Examples>
      <Preview
        label="Joined"
        description="With no product, the heading is the blue wordmark — the job platform, the marketplace, and these docs."
      >
        <Stack gap={3}>
          <TopNav
            label="Joined"
            heading={<BrandHeading headingHref="#" />}
            startContent={<TopNavItem label="Find jobs" href="#" isSelected />}
          />
          <TopNav
            label="Joined for employers"
            heading={
              <BrandHeading
                headingHref="#"
                headerEndContent={<Badge label="Employers" variant="blue" />}
              />
            }
          />
        </Stack>
      </Preview>

      <Preview
        label="Products"
        description="Scoutwell and the admin console show their own names beside the Joined app icon."
      >
        <Stack gap={3}>
          <TopNav
            label="Scoutwell"
            heading={
              <BrandHeading
                product="Scoutwell"
                headingHref="#"
                headerEndContent={<Badge label="Scouts" variant="blue" />}
              />
            }
          />
          <TopNav
            label="Joined Admin"
            heading={
              <BrandHeading
                product="Joined Admin"
                headingHref="#"
                headerEndContent={<Badge label="Staff" variant="neutral" />}
              />
            }
          />
        </Stack>
      </Preview>
    </Examples>
  );
}
