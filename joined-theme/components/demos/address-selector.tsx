"use client";

import { AddressSelector, Stack, Text, formatAddress, type Address } from "sid-ui";
import { useState } from "react";

import { Caption, Examples, Preview } from "./shared";

const FIELD_WIDTH = 420;

const CHICAGO: Address = {
  line1: "233 S Wacker Dr",
  city: "Chicago",
  state: "IL",
  postalCode: "60606",
  country: "United States",
};

export default function AddressSelectorDemo() {
  const [address, setAddress] = useState<Address>(CHICAGO);
  const formatted = formatAddress(address);

  return (
    <Examples>
      <Preview
        align="start"
        label="Headquarters"
        description="Start typing. A Geoapify suggestion fills the street, city, state, and ZIP."
      >
        <Stack gap={3} width={FIELD_WIDTH}>
          <AddressSelector label="Headquarters" value={address} onChange={setAddress} />
          <Caption>
            Saved as{" "}
            <Text type="supporting" weight="medium">
              {formatted || "—"}
            </Text>
          </Caption>
        </Stack>
      </Preview>
    </Examples>
  );
}
