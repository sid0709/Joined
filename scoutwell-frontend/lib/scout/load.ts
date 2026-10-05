import { cache } from "react";
import type { EarningsSummary, Meta, Stats } from "@joined/scout";
import { scoutGet, scoutMeta } from "./server";

/** The signed-in scout's dashboard numbers, once per request. */
export const loadStats = cache(() => scoutGet<Stats>("/stats"));

/** Released earnings by reward type, plus the released total. */
export const loadEarningsSummary = cache(() => scoutGet<EarningsSummary>("/earnings/summary"));

/** Levels, rewards, and input limits. */
export const loadMeta = cache(() => scoutMeta<Meta>());
