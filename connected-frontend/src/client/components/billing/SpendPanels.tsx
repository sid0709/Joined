import type { MeterSegment } from "@/src/client/components/ui/Meter";

import { Meter } from "@/src/client/components/ui/Meter";
import { Panel } from "@/src/client/components/ui/Panel";
import { useHunter } from "@/src/client/context/HunterContext";
import { PACKAGE_BY_ID } from "@/src/client/data/packages";
import { money, relativeTime } from "@/src/client/lib/format";
import { lineAmount } from "@/src/client/lib/selectors";

type Tone = MeterSegment["tone"];
const TONES: Tone[] = ["accent", "violet", "positive", "caution", "soft"];

function Breakdown({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: { label: string; amount: number }[];
}) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <Panel title={title} subtitle={subtitle}>
      {rows.map((row, index) => (
        <div key={row.label} className="hx-stack hx-stack-sm">
          <div className="hx-row hx-row-between">
            <span className="hx-strong">{row.label}</span>
            <span className="hx-num">{money(row.amount)}</span>
          </div>
          <Meter
            label={row.label}
            total={total}
            segments={[{ label: row.label, value: row.amount, tone: TONES[index % TONES.length] }]}
          />
        </div>
      ))}
    </Panel>
  );
}

/** Where the money goes: by package and by bidder, across every invoice. */
export function SpendBreakdowns() {
  const { invoiceLines, bidderById } = useHunter();
  const sum = (key: (line: (typeof invoiceLines)[number]) => string) => {
    const totals = new Map<string, number>();
    for (const line of invoiceLines)
      totals.set(key(line), (totals.get(key(line)) ?? 0) + lineAmount(line));
    return [...totals.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount);
  };
  return (
    <>
      <Breakdown
        title="Spend by package"
        subtitle="Harder systems cost more per link"
        rows={sum((line) => PACKAGE_BY_ID.get(line.packageId)?.name ?? line.packageId)}
      />
      <Breakdown
        title="Spend by bidder"
        subtitle="Across all invoices"
        rows={sum((line) => bidderById(line.bidderId)?.name ?? line.bidderId)}
      />
    </>
  );
}

export function TransactionsPanel() {
  const { transactions } = useHunter();
  return (
    <Panel title="Wallet activity" subtitle="Top-ups, payouts, and refunds" flush>
      <ul className="hx-list">
        {transactions.map((txn) => (
          <li key={txn.id} className="hx-list-item">
            <span className="hx-list-body">
              <span className="hx-list-title">{txn.label}</span>
              <span className="hx-list-meta">{relativeTime(txn.at)}</span>
            </span>
            <strong
              className="hx-num"
              style={{
                color: txn.amount < 0 ? "var(--color-text-primary)" : "var(--color-success)",
              }}
            >
              {txn.amount < 0 ? "−" : "+"}
              {money(Math.abs(txn.amount))}
            </strong>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
