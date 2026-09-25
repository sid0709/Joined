"use client";

import { Button, Text, VisuallyHidden } from "@openseat/design-system";
import { Examples, Preview, Row } from "./shared";

export default function VisuallyHiddenDemo() {
  return (
    <Examples>
      <Preview label="Announced, not shown">
        <Row>
          <Button label="Save">
            Save
            <VisuallyHidden> draft to this room</VisuallyHidden>
          </Button>
          <Text color="secondary">Extra text is announced, not shown.</Text>
        </Row>
      </Preview>
    </Examples>
  );
}
