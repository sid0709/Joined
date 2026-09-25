"use client";

import { useState } from "react";
import { Badge, Button, Card, HStack, Icon, RadioList, RadioListItem, Stack, Text, icons, type RadioListSize } from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const SIZES: RadioListSize[] = ["sm", "md"];
const VISIBILITY = [
  { value: "sealed", label: "Sealed", description: "Invitees can’t see each other’s bids.", icon: icons.lock },
  { value: "open", label: "Open", description: "Everyone sees the lowest bid so far.", icon: icons.eye },
  { value: "public", label: "Public", description: "Anyone with the link can bid.", icon: icons.link },
];
const PLANS = [
  { value: "starter", label: "Starter", price: "Free", description: "3 rooms a month" },
  { value: "team", label: "Team", price: "$24/mo", description: "Unlimited rooms", popular: true },
  { value: "agency", label: "Agency", price: "$79/mo", description: "Client workspaces" },
];
const PAYOUT = [
  { value: "bank", label: "Bank transfer", description: "2–3 business days" },
  { value: "card", label: "Debit card", description: "Instant · 1% fee" },
  { value: "paypal", label: "PayPal", description: "Not available in your region", disabled: true },
];

export default function RadioDemo() {
  const [visibility, setVisibility] = useState("sealed");
  const [plan, setPlan] = useState("team");
  const [payout, setPayout] = useState("bank");
  const [size, setSize] = useState<Record<RadioListSize, string>>({ sm: "a", md: "a" });
  const [rate, setRate] = useState("");
  const [tried, setTried] = useState(false);
  const [layout, setLayout] = useState("week");

  return (
    <Examples>
      <Preview align="start" label="Sizes" description="sm for dense panels; md is the default.">
        <HStack gap={6} wrap="wrap" vAlign="start">
          {SIZES.map((s) => (
            <RadioList key={s} label={`Size ${s}`} size={s} value={size[s]} onChange={(v) => setSize((c) => ({ ...c, [s]: v }))}>
              <RadioListItem value="a" label="Option A" />
              <RadioListItem value="b" label="Option B" />
              <RadioListItem value="c" label="Option C" />
            </RadioList>
          ))}
        </HStack>
      </Preview>

      <Preview align="start" label="Descriptions and icons" description="startContent adds an icon; description explains each choice.">
        <RadioList label="Who can see bids?" description="You can change this until the first bid arrives." value={visibility} onChange={setVisibility}>
          {VISIBILITY.map((v) => (
            <RadioListItem key={v.value} value={v.value} label={v.label} description={v.description} startContent={<Icon icon={v.icon} size="sm" />} />
          ))}
        </RadioList>
      </Preview>

      <Preview align="start" label="Horizontal" description="For two to four short options on one line.">
        <RadioList label="Calendar view" orientation="horizontal" value={layout} onChange={setLayout}>
          <RadioListItem value="day" label="Day" />
          <RadioListItem value="week" label="Week" />
          <RadioListItem value="month" label="Month" />
        </RadioList>
      </Preview>

      <Preview align="start" label="End content" description="Prices, badges, or counts on the right.">
        <Card width={360}>
          <RadioList label="Plan" value={plan} onChange={setPlan}>
            {PLANS.map((p) => (
              <RadioListItem
                key={p.value}
                value={p.value}
                label={
                  <HStack gap={2} vAlign="center">
                    <Text weight="semibold">{p.label}</Text>
                    {p.popular && <Badge label="Popular" variant="blue" />}
                  </HStack>
                }
                aria-label={p.label}
                description={p.description}
                endContent={<Text hasTabularNumbers>{p.price}</Text>}
              />
            ))}
          </RadioList>
        </Card>
      </Preview>

      <Preview align="start" label="Disabled option" description="Disable one item, with the reason in its description.">
        <RadioList label="Payout method" value={payout} onChange={setPayout}>
          {PAYOUT.map((p) => (
            <RadioListItem key={p.value} value={p.value} label={p.label} description={p.description} isDisabled={p.disabled} />
          ))}
        </RadioList>
      </Preview>

      <Preview align="start" label="Required with an error" description="No default, so people make a real choice — then validate on submit.">
        <Stack gap={3} hAlign="start">
          <RadioList
            label="How do you charge?"
            isRequired
            value={rate}
            onChange={setRate}
            status={tried && !rate ? { type: "error", message: "Choose how you charge." } : undefined}
          >
            <RadioListItem value="fixed" label="Fixed price" />
            <RadioListItem value="hourly" label="Hourly" />
            <RadioListItem value="milestone" label="By milestone" />
          </RadioList>
          <Button label="Continue" variant="primary" onClick={() => setTried(true)} />
          {tried && rate && <Caption>Charging: {rate}</Caption>}
        </Stack>
      </Preview>

      <Preview align="start" label="Disabled group" description="Lock the whole list and say why.">
        <RadioList label="Currency" value="usd" onChange={() => undefined} isDisabled disabledMessage="Currency is set by your workspace.">
          <RadioListItem value="usd" label="USD" />
          <RadioListItem value="eur" label="EUR" />
        </RadioList>
      </Preview>
    </Examples>
  );
}
