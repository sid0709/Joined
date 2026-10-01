import { joinedMe } from "@/lib/me/server";
import type { CompanyCounts } from "./api";

export async function loadCompanyCounts(): Promise<CompanyCounts> {
  try {
    const body = await joinedMe<CompanyCounts>("/v1/company/counts");
    return body ?? { openJobs: 0, newApplicants: 0 };
  } catch {
    return { openJobs: 0, newApplicants: 0 };
  }
}
