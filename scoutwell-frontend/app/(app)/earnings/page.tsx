import {
  Button,
  GridColumn,
  GridSystem,
  HStack,
  MetadataList,
  MetadataListItem,
  Stack,
  Text,
  PageHeader,
  SectionCard,
  StatGrid,
} from "@openseat/design-system";
import {
  SENIORITIES,
  SENIORITY_LABEL,
  formatMoney,
  formatRate,
  type Earning,
  type List,
} from "@openseat/scout";
import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { CursorPager } from "@/components/cursor-pager";
import { EarningsTable } from "@/components/earnings/earnings-table";
import { PAGE_LIMIT } from "@/lib/config";
import { param, type SearchParams } from "@/lib/page";
import { ROUTES, signInHref } from "@/lib/routes";
import { loadMeta, loadStats } from "@/lib/scout/load";
import { scoutGet } from "@/lib/scout/server";

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage({ searchParams }: { searchParams: SearchParams }) {
  const cursor = param((await searchParams).cursor);
  const search = new URLSearchParams({ limit: String(PAGE_LIMIT) });
  if (cursor) search.set("cursor", cursor);
  const [stats, meta, earnings] = await Promise.all([
    loadStats(),
    loadMeta(),
    scoutGet<List<Earning>>(`/earnings?${search.toString()}`),
  ]);
  if (!stats || !earnings) redirect(signInHref(ROUTES.earnings));
  const { balance } = stats;
  const { rewards } = meta;

  return (
    <Stack gap={6}>
      <PageHeader
        title="Earnings"
        description={`New rewards are held ${rewards.hold_days} days, then become available to pay out.`}
        action={<Button label="Payouts" variant="secondary" href={ROUTES.payouts} />}
      />
      <StatGrid
        stats={[
          { label: "Available", value: formatMoney(balance.released), hint: "Ready to pay out" },
          {
            label: "On hold",
            value: formatMoney(balance.held),
            hint: `Releases after ${rewards.hold_days} days`,
          },
          {
            label: "Paying out",
            value: formatMoney(balance.processing),
            hint: "In a requested payout",
          },
          {
            label: "Paid",
            value: formatMoney(balance.paid),
            hint: `${formatMoney(balance.lifetime)} earned to date`,
          },
        ]}
      />
      <GridSystem gap={6} align="start">
        <GridColumn span="full" lg={8}>
          <Stack gap={4}>
            <SectionCard title="Reward history">
              <EarningsTable rows={earnings.data} />
            </SectionCard>
            <CursorPager
              basePath={ROUTES.earnings}
              params={{}}
              nextCursor={earnings.next_cursor}
              hasCursor={Boolean(cursor)}
            />
          </Stack>
        </GridColumn>
        <GridColumn span="full" lg={4}>
          <SectionCard
            title="How rewards work"
            description="You are paid for what your jobs produce."
          >
            <MetadataList columns="single">
              <MetadataListItem label="Approval (your level)">
                {formatMoney(stats.level.approval_reward)}
              </MetadataListItem>
              {SENIORITIES.map((level) => (
                <MetadataListItem key={level} label={`${SENIORITY_LABEL[level]} role`}>
                  {formatMoney(rewards.interview_by_seniority[level])} per interview ·{" "}
                  {formatMoney(rewards.hire_by_seniority[level])} per hire
                </MetadataListItem>
              ))}
              <MetadataListItem label="Company conversion">
                {formatRate(rewards.conversion_share)} of that company&apos;s interview fees
              </MetadataListItem>
            </MetadataList>
            <HStack>
              <Text type="supporting" color="secondary" display="block">
                Interview rewards multiply by {stats.level.interview_multiplier}× at your level.
                Rewards on jobs later found to be fake are clawed back.
              </Text>
            </HStack>
          </SectionCard>
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}
