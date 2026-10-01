"use client";

import { CitySelector, Stack } from "@joined/design-system";
import { useState } from "react";

import { Examples, Preview } from "./shared";

const FIELD_WIDTH = 360;

export default function CitySelectorDemo() {
  const [city, setCity] = useState("Chicago");
  const [offices, setOffices] = useState<string[]>(["Chicago", "New York"]);

  return (
    <Examples>
      <Preview
        align="start"
        label="One city"
        description="Type a few letters. Geoapify suggests matching cities."
      >
        <Stack width={FIELD_WIDTH}>
          <CitySelector label="City" value={city} onChange={setCity} />
        </Stack>
      </Preview>
      <Preview
        align="start"
        label="Several cities"
        description="Offices and other multi-city fields. Each Geoapify pick becomes a chip."
      >
        <Stack width={FIELD_WIDTH}>
          <CitySelector label="Offices" multiple value={offices} onChange={setOffices} />
        </Stack>
      </Preview>
    </Examples>
  );
}
