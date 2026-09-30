import { CASE_QUEUES, casesPath, readCaseList } from "../cases";
import {
  VERIFICATION_PENDING_COUNT_PATH,
  directJobsPath,
  readDirectJobList,
  readPendingCount,
  type TrustNavCounts,
} from "../trust";
import { adminGet } from "./api";

/** Pending totals for the shell badges. A missing endpoint leaves the badge off. */
export async function trustNavCounts(): Promise<TrustNavCounts> {
  const [companyVerification, directReview, cases] = await Promise.all([
    companyPending(),
    directPending(),
    openCases(),
  ]);
  return { companyVerification, directReview, cases };
}

async function companyPending() {
  try {
    const pending = readPendingCount(await adminGet<unknown>(VERIFICATION_PENDING_COUNT_PATH));
    return pending ?? undefined;
  } catch {
    return undefined;
  }
}

/** Open reports, disputes, and fraud flags. A missing cases route leaves the badge off. */
async function openCases() {
  const totals = await Promise.all(
    CASE_QUEUES.map(async (queue) => {
      try {
        const list = readCaseList(await adminGet<unknown>(casesPath(queue.value, "open", 1, 1)));
        return list.recognized ? list.total : null;
      } catch {
        return null;
      }
    }),
  );
  if (totals.every((total) => total === null)) return undefined;
  return totals.reduce<number>((sum, total) => sum + (total ?? 0), 0);
}

async function directPending() {
  try {
    const list = readDirectJobList(await adminGet<unknown>(directJobsPath(1, 1)));
    return list.recognized ? list.total : undefined;
  } catch {
    return undefined;
  }
}
