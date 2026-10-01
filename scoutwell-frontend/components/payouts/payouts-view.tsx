"use client";

import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  GridColumn,
  GridSystem,
  HStack,
  Heading,
  Icon,
  List,
  ListItem,
  Stack,
  Text,
  icons,
  useToast,
  PageHeader,
  SectionCard,
} from "@joined/design-system";
import { ApiError, formatMoney, type Money, type Payout, type Stats } from "@joined/scout";
import { scoutSend } from "@/lib/scout/client";
import { PayoutHistory } from "./payout-history";
import { PayoutMethodCard, TaxCard, VerificationCard } from "./setup-cards";

export function PayoutsView({
  stats,
  minPayout,
  payouts,
}: {
  stats: Stats;
  minPayout: Money;
  payouts: Payout[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { profile, balance, payout } = stats;

  const request = async () => {
    try {
      const created = await scoutSend<Payout>("/payouts", "POST");
      toast({ body: `Payout of ${formatMoney(created.amount)} requested.` });
      router.refresh();
    } catch (err) {
      toast({
        body: err instanceof ApiError ? err.message : "Could not request a payout.",
        type: "error",
      });
    }
  };

  const steps = [
    { label: "Identity verified", done: profile.verification === "verified" },
    { label: "Tax details added", done: profile.tax_info !== null },
    { label: "Payout method added", done: profile.payout_method !== null },
    {
      label: `At least ${formatMoney(minPayout)} available`,
      done: balance.released.amount_cents >= minPayout.amount_cents,
    },
  ];

  return (
    <Stack gap={6}>
      <PageHeader
        title="Payouts"
        description="Send your available rewards to your bank or PayPal once your account is set up."
      />
      <Card padding={6} elevation="low">
        <GridSystem gap={6} align="center">
          <GridColumn span="full" md={6}>
            <Stack gap={2}>
              <Text type="supporting" color="secondary">
                Available to pay out
              </Text>
              <Heading level={2} type="display-2">
                {formatMoney(balance.released)}
              </Heading>
              <Text type="supporting" color="secondary" display="block">
                {formatMoney(balance.held)} on hold · {formatMoney(balance.processing)} paying out ·{" "}
                {formatMoney(balance.paid)} paid
              </Text>
              <HStack gap={2}>
                <Button
                  label="Request payout"
                  variant="primary"
                  clickAction={request}
                  isDisabled={!payout.ready}
                />
              </HStack>
            </Stack>
          </GridColumn>
          <GridColumn span="full" md={6}>
            <List density="compact">
              {steps.map((step) => (
                <ListItem
                  key={step.label}
                  label={step.label}
                  startContent={
                    <Text color={step.done ? "accent" : "secondary"}>
                      <Icon icon={step.done ? icons.check : icons.dot} />
                    </Text>
                  }
                />
              ))}
            </List>
          </GridColumn>
        </GridSystem>
      </Card>
      {profile.verification === "rejected" && profile.verification_note ? (
        <Banner
          status="error"
          title="Verification declined"
          description={profile.verification_note}
        />
      ) : null}
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={4}>
          <VerificationCard profile={profile} />
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <TaxCard profile={profile} />
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <PayoutMethodCard profile={profile} />
        </GridColumn>
      </GridSystem>
      <SectionCard title="Payout history">
        <PayoutHistory rows={payouts} />
      </SectionCard>
    </Stack>
  );
}
