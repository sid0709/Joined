"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  CheckboxInput,
  HStack,
  Heading,
  Icon,
  Stack,
  Step,
  Stepper,
  Text,
  icons,
} from "sid-ui";
import { ApiError, formatMoney, type Meta } from "@joined/scout";
import { ROUTES } from "@/lib/routes";
import { scoutSend } from "@/lib/scout/client";

/** What a scout agrees to, with the numbers from the live rulebook. */
function terms(meta: Meta) {
  const start = meta.levels[0];
  return [
    {
      title: "Official links only",
      body: "The employer's careers site or its ATS. Never LinkedIn, Indeed, or another job board.",
    },
    {
      title: "Your own words",
      body: "Write a short summary of the role; never paste the posting.",
    },
    {
      title: "Paid on outcomes",
      body: `Rewards come from settled interviews and confirmed hires, held ${meta.rewards.hold_days} days. Volume alone pays nothing.`,
    },
    {
      title: `You start on ${start?.label ?? "probation"}`,
      body: `${start?.daily_limit ?? 0} submissions a day, each reviewed by a moderator. Quality unlocks auto-approval and approval credits. Payouts start at ${formatMoney(meta.rewards.min_payout)}.`,
    },
    {
      title: "No self-dealing",
      body: "Earnings are voided when you are also the candidate, client, or bidder on a job.",
    },
  ];
}

export function OnboardingForm({ name, meta }: { name: string; meta: Meta }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    setError("");
    try {
      await scoutSend("/me/terms", "POST");
      router.replace(ROUTES.dashboard);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save. Try again.");
    }
  };

  return (
    <Card padding={8}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>Welcome, {name.split(" ")[0]}</Heading>
          <Text color="secondary" display="block">
            One step left: agree to how scouting works.
          </Text>
        </Stack>
        <Stepper activeStep={1} orientation="horizontal">
          <Step step={0} label="Account" />
          <Step step={1} label="Scout terms" />
          <Step step={2} label="Start scouting" />
        </Stepper>
        {error ? <Banner status="error" title={error} /> : null}
        <Stack gap={4}>
          {terms(meta).map((term) => (
            <HStack key={term.title} gap={3} vAlign="start">
              <Text color="accent">
                <Icon icon={icons.check} />
              </Text>
              <Stack gap={0.5}>
                <Text weight="semibold">{term.title}</Text>
                <Text type="supporting" color="secondary" display="block">
                  {term.body}
                </Text>
              </Stack>
            </HStack>
          ))}
        </Stack>
        <CheckboxInput label="I agree to the scout terms" value={agreed} onChange={setAgreed} />
        <Button
          label="Start scouting"
          variant="primary"
          clickAction={accept}
          isDisabled={!agreed}
        />
      </Stack>
    </Card>
  );
}
