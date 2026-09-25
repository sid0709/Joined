"use client";

import { useState } from "react";
import {
  Button,
  Divider,
  FormLayout,
  GridColumn,
  GridSystem,
  ResponsiveFrame,
  ResponsiveStack,
  Selector,
  Stack,
  Text,
  TextArea,
  TextInput,
} from "@openseat/design-system";
import { Examples, Preview } from "./shared";

type Fields = Record<"title" | "budget" | "brief" | "first" | "last" | "email" | "street" | "city" | "region" | "zip", string>;

const INITIAL: Fields = {
  title: "Brand refresh",
  budget: "2400",
  brief: "",
  first: "",
  last: "",
  email: "",
  street: "",
  city: "",
  region: "",
  zip: "",
};

export default function FormLayoutDemo() {
  const [f, setF] = useState(INITIAL);
  const [visibility, setVisibility] = useState("sealed");
  const bind = (key: keyof Fields) => ({
    value: f[key],
    onChange: (value: string) => setF((c) => ({ ...c, [key]: value })),
  });

  return (
    <Examples>
      <Preview label="Vertical" description="The default: one field per row with shared spacing.">
        <Stack maxWidth={420}>
          <FormLayout>
            <TextInput label="Room title" {...bind("title")} />
            <TextInput label="Budget" {...bind("budget")} description="Bidders see this as a ceiling." />
            <TextArea label="Brief" placeholder="What does great look like?" {...bind("brief")} />
            <Selector
              label="Visibility"
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: "sealed", label: "Sealed — invited bidders only" },
                { value: "open", label: "Open — anyone with the link" },
              ]}
            />
          </FormLayout>
        </Stack>
      </Preview>

      <Preview label="Horizontal" description="Short, related fields share one row.">
        <FormLayout direction="horizontal">
          <TextInput label="City" {...bind("city")} />
          <TextInput label="Region" {...bind("region")} />
          <TextInput label="ZIP" {...bind("zip")} />
        </FormLayout>
      </Preview>

      <Preview label="Responsive — one column on phones, two from md" description="GridSystem places fields; spans say which pairs share a row.">
        <ResponsiveFrame defaultPreset="Laptop">
          <GridSystem gap={4} rowGap={3}>
            <GridColumn span={12} md={6}>
              <TextInput label="First name" {...bind("first")} />
            </GridColumn>
            <GridColumn span={12} md={6}>
              <TextInput label="Last name" {...bind("last")} />
            </GridColumn>
            <GridColumn span={12}>
              <TextInput label="Email" type="email" {...bind("email")} />
            </GridColumn>
            <GridColumn span={12}>
              <TextInput label="Street" {...bind("street")} />
            </GridColumn>
            <GridColumn span={12} sm={6} md={5}>
              <TextInput label="City" {...bind("city")} />
            </GridColumn>
            <GridColumn span={6} md={4}>
              <TextInput label="Region" {...bind("region")} />
            </GridColumn>
            <GridColumn span={6} sm={12} md={3}>
              <TextInput label="ZIP" {...bind("zip")} />
            </GridColumn>
          </GridSystem>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Responsive settings form" description="Label and hint on the left from md; stacked above the field on phones.">
        <ResponsiveFrame defaultPreset="Laptop">
          <Stack gap={4}>
            {[
              { key: "title" as const, label: "Room title", hint: "Shown on invites." },
              { key: "budget" as const, label: "Budget ceiling", hint: "Bids above this are flagged." },
              { key: "brief" as const, label: "Brief", hint: "Two or three sentences." },
            ].map((row) => (
              <GridSystem key={row.key} gap={4}>
                <GridColumn span={12} md={4}>
                  <Stack gap={0.5}>
                    <Text weight="medium">{row.label}</Text>
                    <Text type="supporting" color="secondary">
                      {row.hint}
                    </Text>
                  </Stack>
                </GridColumn>
                <GridColumn span={12} md={8}>
                  {row.key === "brief" ? <TextArea label={row.label} {...bind(row.key)} /> : <TextInput label={row.label} {...bind(row.key)} />}
                </GridColumn>
              </GridSystem>
            ))}
          </Stack>
        </ResponsiveFrame>
      </Preview>

      <Preview label="Pattern — grouped form with responsive actions">
        <ResponsiveFrame defaultPreset="Phone">
          <Stack gap={4}>
            <Text weight="semibold">Contact</Text>
            <FormLayout>
              <TextInput label="Name" {...bind("first")} />
              <TextInput label="Email" type="email" {...bind("email")} />
            </FormLayout>
            <Divider />
            <Text weight="semibold">Room</Text>
            <FormLayout>
              <TextInput label="Title" {...bind("title")} />
              <TextArea label="Brief" {...bind("brief")} />
            </FormLayout>
            <ResponsiveStack from="sm" gap={2} isReversedWhenStacked>
              <Button label="Save draft" width="100%" />
              <Button label="Post room" variant="primary" width="100%" />
            </ResponsiveStack>
          </Stack>
        </ResponsiveFrame>
      </Preview>
    </Examples>
  );
}
