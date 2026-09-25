"use client";

import { useState } from "react";
import { Card, Divider, HStack, Heading, Icon, NumberInput, Stack, Text, icons, type NumberInputSize } from "@openseat/design-system";
import { Examples, Preview } from "./shared";

const SIZES: NumberInputSize[] = ["sm", "md", "lg"];
const FIELD_WIDTH = 240;
const FEE_RATE = 0.05;
const MAX_SEATS = 50;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const percent = (v: number) => `${v}%`;

export default function NumberInputDemo() {
  const [sizes, setSizes] = useState<Record<NumberInputSize, number>>({ sm: 1, md: 2, lg: 3 });
  const [budget, setBudget] = useState(2400);
  const [seats, setSeats] = useState(5);
  const [discount, setDiscount] = useState(10);
  const [days, setDays] = useState<number | null>(14);
  const [rate, setRate] = useState(65);
  const [hours, setHours] = useState(24);
  const [bid, setBid] = useState(0);

  const subtotal = rate * hours;
  const fee = Math.round(subtotal * FEE_RATE);

  return (
    <Examples>
      <Preview align="start" label="Sizes">
        <HStack gap={3} wrap="wrap" vAlign="end">
          {SIZES.map((size) => (
            <NumberInput key={size} size={size} label={`Size ${size}`} value={sizes[size]} onChange={(v) => setSizes((c) => ({ ...c, [size]: v }))} width={FIELD_WIDTH / 2} />
          ))}
        </HStack>
      </Preview>

      <Preview align="start" label="Steppers and limits" description="hasNumberSteppers adds − and +; min, max, and step keep the value valid.">
        <HStack gap={4} wrap="wrap" vAlign="start">
          <NumberInput label="Seats" value={seats} onChange={setSeats} min={1} max={MAX_SEATS} hasNumberSteppers isIntegerOnly width={FIELD_WIDTH / 1.5} description={`1 to ${MAX_SEATS}`} />
          <NumberInput label="Discount" value={discount} onChange={setDiscount} min={0} max={100} step={5} hasNumberSteppers formatValue={percent} width={FIELD_WIDTH / 1.5} />
        </HStack>
      </Preview>

      <Preview align="start" label="Units and formatting" description="units sits beside the number; formatValue formats it when not editing.">
        <HStack gap={4} wrap="wrap" vAlign="start">
          <NumberInput label="Budget" value={budget} onChange={setBudget} formatValue={(v) => usd.format(v)} startIcon={<Icon icon={icons.seat} />} width={FIELD_WIDTH} />
          <NumberInput label="Hourly rate" value={rate} onChange={setRate} units="$/hr" width={FIELD_WIDTH} />
          <NumberInput label="Weight" value={2.5} onChange={() => undefined} units="kg" step={0.1} width={FIELD_WIDTH / 1.5} />
        </HStack>
      </Preview>

      <Preview align="start" label="Clearable" description="hasClear allows an empty value — onChange then receives null.">
        <NumberInput label="Delivery in days" value={days} onChange={setDays} hasClear isOptional placeholder="Flexible" units="days" width={FIELD_WIDTH} />
      </Preview>

      <Preview align="start" label="Scroll to change" description="isWheelEnabled lets the scroll wheel adjust a focused field.">
        <NumberInput label="Seats (scroll me)" value={seats} onChange={setSeats} isWheelEnabled min={1} max={MAX_SEATS} width={FIELD_WIDTH} />
      </Preview>

      <Preview align="start" label="Status" description="Validate against the room’s rules as people type.">
        <NumberInput
          label="Your bid"
          value={bid}
          onChange={setBid}
          formatValue={(v) => usd.format(v)}
          width={FIELD_WIDTH}
          status={
            bid <= 0
              ? { type: "error", message: "Enter an amount above $0." }
              : bid > budget
                ? { type: "warning", message: `Over the ${usd.format(budget)} budget.` }
                : { type: "success", message: "Within budget." }
          }
        />
      </Preview>

      <Preview align="start" label="Read-only and disabled">
        <HStack gap={4} wrap="wrap">
          <NumberInput label="Platform fee" value={5} onChange={() => undefined} units="%" isReadOnly width={FIELD_WIDTH / 1.5} />
          <NumberInput label="Deposit" value={0} onChange={() => undefined} isDisabled disabledMessage="Deposits are off for this room." width={FIELD_WIDTH / 1.5} />
        </HStack>
      </Preview>

      <Preview label="Bid calculator" description="Several inputs feed one live total.">
        <Card maxWidth={420}>
          <Stack gap={3}>
            <Heading level={4}>Estimate your bid</Heading>
            <HStack gap={3} wrap="wrap">
              <NumberInput label="Rate" value={rate} onChange={setRate} units="$/hr" hasNumberSteppers step={5} min={0} width={170} />
              <NumberInput label="Hours" value={hours} onChange={setHours} hasNumberSteppers min={1} isIntegerOnly width={140} />
            </HStack>
            <Divider />
            <Stack gap={1}>
              <HStack hAlign="between">
                <Text color="secondary">Subtotal</Text>
                <Text hasTabularNumbers>{usd.format(subtotal)}</Text>
              </HStack>
              <HStack hAlign="between">
                <Text color="secondary">Platform fee ({FEE_RATE * 100}%)</Text>
                <Text hasTabularNumbers>−{usd.format(fee)}</Text>
              </HStack>
              <HStack hAlign="between">
                <Text weight="semibold">You receive</Text>
                <Text weight="semibold" hasTabularNumbers>
                  {usd.format(subtotal - fee)}
                </Text>
              </HStack>
            </Stack>
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
