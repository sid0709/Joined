"use client";

import { Glyph } from "sid-ui";
import Link from "next/link";
import { useState } from "react";

import type { Bidder, Inquiry, Task } from "@/src/shared/types/marketplace";

import { useHunter } from "@/src/client/context/HunterContext";
import { NumberField } from "@/src/shared/kit/Fields";
import { Person } from "@/src/shared/kit/Person";
import { money } from "@/src/shared/lib/format";
import { Button, Select } from "@/src/shared/marketplace-ui";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { HUNTER_ROUTES } from "@/src/shared/routes/hunter";

interface BidderSidebarProps {
  inquiry: Inquiry;
  bidder: Bidder;
  task: Task;
}

/** Who you are talking to, what they proposed, and how to reach them once connected. */
export function BidderSidebar({ inquiry, bidder, task }: BidderSidebarProps) {
  const { sendOffer } = useHunter();
  const [packageId, setPackageId] = useState(task.packageLines[0]?.packageId ?? "");
  const [rate, setRate] = useState(task.packageLines[0]?.rate.toFixed(2) ?? "");
  const connected = inquiry.status === "connected";
  const negotiable = inquiry.status === "new" || inquiry.status === "negotiating";

  return (
    <div className="hx-panel-body">
      <Person name={bidder.name} detail={`${bidder.level} bidder`} size={48} />
      <p className="hx-small hx-muted" style={{ margin: 0 }}>
        {bidder.headline}
      </p>

      <dl className="hx-kv">
        <dt>Rating</dt>
        <dd>
          <span className="hx-score">
            <span className="hx-star">
              <Glyph name="star" />
            </span>
            {bidder.rating} <span className="hx-muted">({bidder.reviews})</span>
          </span>
        </dd>
        <dt>Links done</dt>
        <dd className="hx-num">{bidder.completedLinks.toLocaleString("en-US")}</dd>
        <dt>QA pass rate</dt>
        <dd className="hx-num">{bidder.qaPassRate}%</dd>
        <dt>Avg. time</dt>
        <dd className="hx-num">{bidder.avgMinutesPerLink} min / link</dd>
        <dt>Specialties</dt>
        <dd>{bidder.specialties.join(", ")}</dd>
      </dl>

      <div className="hx-contact">
        <strong className="hx-strong hx-small">Contact</strong>
        {connected ? (
          <dl className="hx-kv" style={{ marginTop: "var(--space-2)" }}>
            <dt>Email</dt>
            <dd>{bidder.email}</dd>
            <dt>Handle</dt>
            <dd>{bidder.handle}</dd>
            <dt>Timezone</dt>
            <dd>{bidder.timezone}</dd>
          </dl>
        ) : (
          <p className="hx-small hx-muted" style={{ margin: "var(--space-1) 0 0" }}>
            <Glyph name="lock" /> Email and handle unlock when you accept this inquiry.
          </p>
        )}
      </div>

      {negotiable && (
        <div className="hx-stack hx-stack-sm">
          <strong className="hx-strong">Counter-offer</strong>
          <Select
            label="Package"
            value={packageId}
            onChange={(event) => setPackageId(event.target.value)}
          >
            {task.packageLines.map((line) => (
              <option key={line.packageId} value={line.packageId}>
                {PACKAGE_BY_ID.get(line.packageId)?.name} · listed {money(line.rate)}
              </option>
            ))}
          </Select>
          <NumberField label="Rate per link (USD)" step={0.05} value={rate} onChange={setRate} />
          <Button
            variant="secondary"
            label="Send counter-offer"
            disabled={!Number(rate)}
            onClick={() => sendOffer(inquiry.id, packageId, Number(rate))}
          />
        </div>
      )}

      <Link href={HUNTER_ROUTES.task(task.id)} className="hx-link hx-small">
        View task · {task.title}
      </Link>
    </div>
  );
}
