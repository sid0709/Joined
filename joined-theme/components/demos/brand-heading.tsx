"use client";

import { Badge, BrandHeading, Stack, TopNav, TopNavItem } from "@joined/design-system";

import { Examples, Preview } from "./shared";

export default function BrandHeadingDemo() {
  return (
    <Examples>
      <Preview
        label="Joined"
        description="With no product, the heading is the blue wordmark — the Joined marketplace and these docs."
      >
        <TopNav
          label="Joined"
          heading={<BrandHeading headingHref="#" />}
          startContent={<TopNavItem label="Rooms" href="#" isSelected />}
        />
      </Preview>

      <Preview
        label="Products"
        description="Opened, Scoutwell, and the admin console keep their names; the Joined app icon sits beside them."
      >
        <Stack gap={3}>
          <TopNav label="Opened" heading={<BrandHeading product="Opened" headingHref="#" />} />
          <TopNav
            label="Opened for employers"
            heading={
              <BrandHeading
                product="Opened"
                headingHref="#"
                headerEndContent={<Badge label="Employers" variant="blue" />}
              />
            }
          />
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
            label="Opened Admin"
            heading={
              <BrandHeading
                product="Opened Admin"
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
