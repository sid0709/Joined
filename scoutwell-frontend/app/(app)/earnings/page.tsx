import { Card, PageHeader, PageTabs, Stack } from "@joined/design-system";
import { type Earning, type List } from "@joined/scout";

import type { Metadata } from "next";

import { CursorPager } from "@/components/cursor-pager";
import { BalanceOverview } from "@/components/earnings/balance-overview";
import { EarningsList } from "@/components/earnings/earnings-list";
import { EarningsSignedOut } from "@/components/earnings/earnings-signed-out";
import { RewardRules } from "@/components/earnings/reward-rules";
import { PAGE_LIMIT } from "@/lib/config";
import { param, type SearchParams } from "@/lib/page";
import { ROUTES } from "@/lib/routes";
import { loadEarningsSummary, loadMeta, loadStats } from "@/lib/scout/load";
import { scoutGet } from "@/lib/scout/server";

export const metadata: Metadata = { title: "Earnings" };

const TAB_RULES = "rules";
const TAB_HISTORY = "history";
const TABS = [
  { value: TAB_HISTORY, label: "Reward history", href: ROUTES.earnings },
  { value: TAB_RULES, label: "How rewards work", href: `${ROUTES.earnings}?tab=${TAB_RULES}` },
];

export default async function EarningsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const cursor = param(query.cursor);
  const tab = param(query.tab) === TAB_RULES ? TAB_RULES : TAB_HISTORY;
  const search = new URLSearchParams({ limit: String(PAGE_LIMIT) });
  if (cursor) search.set("cursor", cursor);
  const [stats, meta, summary, earnings] = await Promise.all([
    loadStats(),
    loadMeta(),
    loadEarningsSummary(),
    scoutGet<List<Earning>>(`/earnings?${search.toString()}`),
  ]);
  if (!stats || !summary || !earnings) return <EarningsSignedOut />;
  const { rewards } = meta;

  return (
    <Stack gap={6}>
      <PageHeader
        title="Earnings"
        description="What you’ve earned, from which jobs, and what’s still pending."
      />
      <BalanceOverview balance={stats.balance} summary={summary} rewards={rewards} />
      <PageTabs tabs={TABS} value={tab} label="Earnings views" />
      {tab === TAB_RULES ? (
        <Card padding={6}>
          <Stack gap={4}>
            <RewardRules rewards={rewards} level={stats.level} />
          </Stack>
        </Card>
      ) : (
        <Stack gap={4}>
          <EarningsList rows={earnings.data} />
          <CursorPager
            basePath={ROUTES.earnings}
            params={{}}
            nextCursor={earnings.next_cursor}
            hasCursor={Boolean(cursor)}
          />
        </Stack>
      )}
    </Stack>
  );
}
