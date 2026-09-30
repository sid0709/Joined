"use client";

import { useMemo, useState } from "react";

import { MONEY_LINKS, SectionNav } from "@/src/candidate/components/ui/SectionNav";
import { PayoutBadge } from "@/src/candidate/components/ui/StatusBadges";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { RATE_LEVELS } from "@/src/candidate/data/account";
import { BOARD_TASK_BY_ID, HUNTER_BY_ID } from "@/src/candidate/data/board";
import {
  applicationEarning,
  bidderQa,
  earningsSummary,
  MIN_EARLY_PAYOUT,
  payoutNet,
  PLATFORM_FEE,
} from "@/src/candidate/lib/derive";
import { NumberField } from "@/src/shared/kit/Fields";
import { Meter } from "@/src/shared/kit/Meter";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { StatCard } from "@/src/shared/kit/StatCard";
import { longDate, money, percent, plural, shortDate } from "@/src/shared/lib/format";
import { Badge, Banner, Button, Modal, PageBody, Select } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

const METHODS = [
  "Bank transfer · Chase ending 6620",
  "Bank transfer · Wells Fargo ending 1189",
  "PayPal · alex.morgan@bidmail.io",
  "Wise · USD balance",
];
const MS_PER_DAY = 86_400_000;

export function EarningsView() {
  const {
    applications,
    assignments,
    payouts,
    transactions,
    profile,
    requestEarlyPayout,
    updateProfile,
  } = useBidderWorkspace();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [method, setMethod] = useState(profile.payoutMethod);
  const [changing, setChanging] = useState(false);

  const summary = earningsSummary(applications, assignments, payouts, transactions);
  const qa = bidderQa(applications);
  const delivered = applications.filter((item) => item.status === "qa_passed").length;

  const desks = useMemo(
    () =>
      assignments.map((assignment) => {
        const own = applications.filter((item) => item.assignmentId === assignment.id);
        const passed = own.filter((item) => item.status === "qa_passed");
        const pending = own.filter((item) => item.status === "submitted");
        const task = BOARD_TASK_BY_ID.get(assignment.taskId);
        return {
          assignment,
          hunter: task && HUNTER_BY_ID.get(task.hunterId),
          passed: passed.length,
          net: passed.reduce((sum, item) => sum + applicationEarning(item, assignments), 0),
          pending: pending.reduce((sum, item) => sum + applicationEarning(item, assignments), 0),
        };
      }),
    [assignments, applications],
  );

  const weeks = useMemo(() => {
    const map = new Map<string, number>();
    for (const payout of payouts)
      map.set(payout.period, (map.get(payout.period) ?? 0) + payoutNet(payout));
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  }, [payouts]);
  const maxWeek = Math.max(...weeks.map(([, net]) => net), 1);

  const next = RATE_LEVELS[RATE_LEVELS.findIndex((item) => item.level === profile.level) + 1];
  const payoutDate = (period: string) =>
    new Date(new Date(`${period}T00:00:00Z`).getTime() + 11 * MS_PER_DAY).toISOString();

  const request = () => {
    const value = Number(amount);
    const result = requestEarlyPayout(value);
    setMessage(
      result.ok
        ? { ok: true, text: `${money(value)} is on its way to your account.` }
        : { ok: false, text: result.error ?? "" },
    );
    if (result.ok) setAmount("");
  };

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Earnings"
          title="What you have earned and when you get paid"
          description="Every QA-passed link earns the rate you agreed with the hunter, minus an 8% platform fee. Payouts run every Friday for the week before."
          actions={
            <Button href={BIDDER_ROUTES.work} variant="primary" label="Earn more in My Work" />
          }
        />
        <SectionNav label="Earnings sections" links={MONEY_LINKS} />

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="Available for early payout"
            value={money(summary.availableEarly)}
            icon="download"
            tone="success"
            footnote={`Minimum ${money(MIN_EARLY_PAYOUT)}`}
          />
          <StatCard
            label="Scheduled this Friday"
            value={money(summary.processing)}
            icon="calendar"
            tone="warning"
            footnote="Approved links from last week"
          />
          <StatCard
            label="Accruing this week"
            value={money(summary.scheduled)}
            icon="clock"
            footnote="Approved, paid next Friday"
          />
          <StatCard
            label="Awaiting QA"
            value={money(summary.awaiting)}
            icon="eye"
            footnote={`${plural(applications.filter((item) => item.status === "submitted").length, "link")} under review`}
          />
        </div>

        <div className="hx-split">
          <div className="hx-stack">
            <Panel
              title="Earnings by desk"
              subtitle="Rates are agreed per package with each hunter"
              flush
            >
              <div className="bx-table-wrap">
                <table className="bx-table">
                  <thead>
                    <tr>
                      <th>Desk</th>
                      <th>Rate</th>
                      <th>Approved links</th>
                      <th>Net earned</th>
                      <th>Awaiting QA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desks.map(({ assignment, hunter, passed, net, pending }) => (
                      <tr key={assignment.id}>
                        <td>
                          <strong>{hunter?.company}</strong>
                          <span className="hx-small hx-muted bx-block">
                            {PACKAGE_BY_ID.get(assignment.packageId)?.name}
                            {assignment.status === "completed" ? " · completed" : ""}
                          </span>
                        </td>
                        <td className="hx-num">{money(assignment.rate)}</td>
                        <td className="hx-num">
                          {passed} / {assignment.jobIds.length}
                        </td>
                        <td className="hx-num">
                          <strong>{money(net)}</strong>
                        </td>
                        <td className="hx-num">{money(pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Payouts" subtitle="One payout per hunter each week" flush>
              <div className="bx-table-wrap">
                <table className="bx-table">
                  <thead>
                    <tr>
                      <th>Week of</th>
                      <th>Hunter</th>
                      <th>Links</th>
                      <th>Gross</th>
                      <th>Fee</th>
                      <th>Net</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout) => (
                      <tr key={payout.id}>
                        <td>
                          {shortDate(`${payout.period}T00:00:00Z`)}
                          <span className="hx-small hx-muted bx-block">
                            {payout.status === "paid"
                              ? `Paid ${shortDate(payout.paidAt ?? "")}`
                              : `Pays ${shortDate(payoutDate(payout.period))}`}
                          </span>
                        </td>
                        <td>{HUNTER_BY_ID.get(payout.hunterId)?.company}</td>
                        <td className="hx-num">{payout.links}</td>
                        <td className="hx-num">{money(payout.gross)}</td>
                        <td className="hx-num">−{money(payout.fee)}</td>
                        <td className="hx-num">
                          <strong>{money(payoutNet(payout))}</strong>
                        </td>
                        <td>
                          <PayoutBadge status={payout.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Wallet activity" flush>
              <ul className="hx-list">
                {[...transactions]
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .map((transaction) => (
                    <li key={transaction.id} className="hx-list-item">
                      <span className="hx-list-body">
                        <span className="hx-list-title">{transaction.label}</span>
                        <span className="hx-list-meta">{longDate(transaction.at)}</span>
                      </span>
                      <strong
                        className="hx-num"
                        style={{
                          color:
                            transaction.amount < 0
                              ? "var(--color-text-primary)"
                              : "var(--color-success)",
                        }}
                      >
                        {transaction.amount < 0 ? "−" : "+"}
                        {money(Math.abs(transaction.amount))}
                      </strong>
                    </li>
                  ))}
              </ul>
            </Panel>
          </div>

          <div className="hx-stack">
            <Panel title="Request an early payout" subtitle="Get approved earnings before Friday">
              <div className="hx-inline-form">
                <NumberField
                  label="Amount (USD)"
                  value={amount}
                  onChange={setAmount}
                  min={0}
                  step={5}
                  helper={`Up to ${money(summary.availableEarly)}`}
                />
                <div className="hx-chip-row">
                  {[25, 50]
                    .filter((value) => value < summary.availableEarly)
                    .map((value) => (
                      <button
                        key={value}
                        type="button"
                        className="hx-chip"
                        onClick={() => setAmount(String(value))}
                      >
                        {money(value)}
                      </button>
                    ))}
                  {summary.availableEarly >= MIN_EARLY_PAYOUT && (
                    <button
                      type="button"
                      className="hx-chip"
                      onClick={() => setAmount(String(summary.availableEarly))}
                    >
                      Everything ({money(summary.availableEarly)})
                    </button>
                  )}
                </div>
                {message && (
                  <Banner tone={message.ok ? "success" : "danger"} title={message.text} />
                )}
                <Button
                  variant="primary"
                  label="Request payout"
                  disabled={!(Number(amount) > 0)}
                  onClick={request}
                />
                <span className="hx-small hx-muted">Sent to {profile.payoutMethod}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  label="Change payout method"
                  onClick={() => setChanging(true)}
                />
              </div>
            </Panel>

            <Panel title="Weekly net earnings">
              <div className="hx-stack hx-stack-sm">
                {weeks.map(([period, net]) => (
                  <div key={period} className="bx-week">
                    <span className="hx-small hx-muted">{shortDate(`${period}T00:00:00Z`)}</span>
                    <Meter
                      label={`Week of ${period}`}
                      total={maxWeek}
                      segments={[{ label: "Net", value: net, tone: "positive" }]}
                    />
                    <strong className="hx-num hx-small">{money(net)}</strong>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="Your rate level"
              subtitle={`${profile.level} · ${percent(qa, 1)} QA · ${delivered} links`}
            >
              <div className="hx-stack hx-stack-sm">
                {RATE_LEVELS.map((level) => (
                  <div
                    key={level.level}
                    className="bx-ladder-row"
                    data-active={level.level === profile.level}
                  >
                    <div className="hx-row hx-row-between">
                      <strong>{level.level}</strong>
                      <Badge
                        label={level.multiplier}
                        tone={level.level === profile.level ? "info" : "neutral"}
                      />
                    </div>
                    <span className="hx-small hx-muted">
                      {level.minQa ? `${level.minQa}%+ QA · ` : ""}
                      {level.minLinks ? `${level.minLinks}+ links` : "Everyone starts here"}
                    </span>
                    <span className="hx-small hx-faint">{level.perks.join(" · ")}</span>
                  </div>
                ))}
                {next && (
                  <div className="hx-stack hx-stack-sm">
                    <span className="hx-small hx-muted">Progress to {next.level}</span>
                    <Meter
                      label="Links toward next level"
                      total={next.minLinks}
                      segments={[
                        {
                          label: "Links",
                          value: Math.min(delivered, next.minLinks),
                          tone: "accent",
                        },
                      ]}
                    />
                    <span className="hx-small hx-faint">
                      {Math.max(0, next.minLinks - delivered)} more approved links and {next.minQa}%
                      QA
                    </span>
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="Fees">
              <p className="hx-muted hx-small" style={{ margin: 0 }}>
                OpenSeat keeps {percent(PLATFORM_FEE * 100)} of every approved link to cover
                payments, support and dispute handling. Hunters never see this fee and you never pay
                to receive a payout.
              </p>
            </Panel>
          </div>
        </div>
      </div>

      <Modal
        open={changing}
        onClose={() => setChanging(false)}
        title="Payout method"
        footer={
          <div className="hx-row hx-row-between" style={{ padding: "var(--space-4)" }}>
            <Button variant="ghost" label="Cancel" onClick={() => setChanging(false)} />
            <Button
              variant="primary"
              label="Save"
              onClick={() => {
                updateProfile({ payoutMethod: method });
                setChanging(false);
              }}
            />
          </div>
        }
      >
        <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
          <Select
            label="Send payouts to"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            {METHODS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </PageBody>
  );
}
