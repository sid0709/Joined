import { adminGet } from "./api";
import {
  VERIFICATION_PENDING_COUNT_PATH,
  directJobsPath,
  readDirectJobList,
  readPendingCount,
  type TrustNavCounts,
} from "../trust";

/** Pending totals for the shell badges. A missing endpoint leaves the badge off. */
export async function trustNavCounts(): Promise<TrustNavCounts> {
  const [companyVerification, directReview] = await Promise.all([
    companyPending(),
    directPending(),
  ]);
  return { companyVerification, directReview };
}

async function companyPending() {
  try {
    const pending = readPendingCount(await adminGet<unknown>(VERIFICATION_PENDING_COUNT_PATH));
    return pending ?? undefined;
  } catch {
    return undefined;
  }
}

async function directPending() {
  try {
    const list = readDirectJobList(await adminGet<unknown>(directJobsPath(1, 1)));
    return list.recognized ? list.total : undefined;
  } catch {
    return undefined;
  }
}
