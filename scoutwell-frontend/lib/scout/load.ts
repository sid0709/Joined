import { cache } from "react";
import type { Meta, Stats } from "@openseat/scout";
import { scoutGet, scoutMeta } from "./server";

/** The signed-in scout's dashboard numbers, once per request. */
export const loadStats = cache(() => scoutGet<Stats>("/stats"));

/** Levels, rewards, and input limits. */
export const loadMeta = cache(() => scoutMeta<Meta>());
