import { adminGet } from "./api";
import {
  CASE_STATUS_PENDING,
  DIRECT_JOB_PENDING,
  companyCasesPath,
  directJobsPath,
  readCaseList,
  readDirectJobList,
  type ReadList,
  type TrustNavCounts,
} from "../trust";

/** Pending totals for the shell badges. A missing endpoint leaves the badge off. */
export async function trustNavCounts(): Promise<TrustNavCounts> {
  const [companyVerification, directReview] = await Promise.all([
    pendingTotal(companyCasesPath(CASE_STATUS_PENDING, 1, 1), readCaseList),
    pendingTotal(directJobsPath(DIRECT_JOB_PENDING, 1, 1), readDirectJobList),
  ]);
  return { companyVerification, directReview };
}

async function pendingTotal(path: string, read: (body: unknown) => ReadList<unknown>) {
  try {
    const list = read(await adminGet<unknown>(path));
    return list.recognized ? list.total : undefined;
  } catch {
    return undefined;
  }
}
