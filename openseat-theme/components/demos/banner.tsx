"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Stack } from "@astryxdesign/core/Stack";
import { Examples, Preview } from "./shared";

export default function BannerDemo() {
  return (
    <Examples>
      <Preview label="Status">
        <Stack gap={3}>
          <Banner status="info" title="2 items are running low" description="Invite another person before the room closes." />
          <Banner status="success" title="Invite sent" description="They’ll see this room once they accept." isDismissable />
          <Banner status="warning" title="Room closes tonight" description="Award a bid before midnight." />
          <Banner
            status="error"
            title="Payment failed"
            description="Update the card on file and try again."
            endContent={<Button label="Retry" variant="secondary" size="sm" />}
          />
        </Stack>
      </Preview>
    </Examples>
  );
}
