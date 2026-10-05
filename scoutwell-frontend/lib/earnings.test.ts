import { describe, expect, it } from "bun:test";
import type { Balance, Earning, EarningsSummary, Money } from "@joined/scout";

import { earningJobLabel, earningsCards } from "./earnings";

const usd = (amount_cents: number): Money => ({ amount_cents, currency: "USD" });

const balance = (overrides: Partial<Balance> = {}): Balance => ({
  held: usd(0),
  released: usd(0),
  processing: usd(0),
  paid: usd(0),
  clawed_back: usd(0),
  lifetime: usd(0),
  ...overrides,
});

const earning = (overrides: Partial<Earning> = {}): Earning => ({
  id: "e1",
  scout_user_id: "s1",
  type: "apply",
  amount: usd(500),
  status: "held",
  description: "A candidate applied to your job.",
  hold_until: "2026-10-19T00:00:00.000Z",
  created_at: "2026-10-05T00:00:00.000Z",
  ...overrides,
});

describe("earningJobLabel", () => {
  it("joins title and company when both are present", () => {
    expect(earningJobLabel(earning({ job_title: "Staff Engineer", company_name: "Acme" }))).toBe(
      "Staff Engineer · Acme",
    );
  });

  it("uses the title alone when the company is missing", () => {
    expect(earningJobLabel(earning({ job_title: "Staff Engineer" }))).toBe("Staff Engineer");
  });

  it("falls back to the API description when there is no job", () => {
    expect(earningJobLabel(earning())).toBe("A candidate applied to your job.");
  });
});

describe("earningsCards", () => {
  it("maps lifetime, held, and paid, and keeps the released summary total", () => {
    const summary: EarningsSummary = { by_type: { apply: usd(400) }, total: usd(400) };
    expect(
      earningsCards(
        balance({ held: usd(250), paid: usd(800), lifetime: usd(1450), released: usd(400) }),
        summary,
      ),
    ).toEqual({
      total: usd(1450),
      pending: usd(250),
      paid: usd(800),
      released: usd(400),
    });
  });
});
