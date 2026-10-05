"use client";

import { Stack, StateSelector } from "sid-ui";
import { useState } from "react";

import { Examples, Preview } from "./shared";

const FIELD_WIDTH = 360;

export default function StateSelectorDemo() {
  const [state, setState] = useState("IL");

  return (
    <Examples>
      <Preview
        align="start"
        label="US state"
        description="Search by name. The stored value is the postal abbreviation."
      >
        <Stack width={FIELD_WIDTH}>
          <StateSelector label="State" value={state} onChange={setState} />
        </Stack>
      </Preview>
    </Examples>
  );
}
