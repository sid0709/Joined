import { jobInfoUrlFrom, parseDetail } from "./parseDetail.js";
import { salaryFromJobCard } from "./parseDom.js";
import { hasNextDataJob } from "./parseNextData.js";

function jobIdFromUrl(url) {
  try {
    const match = new URL(url).pathname.match(/\/jobs\/info\/([^/]+)/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

/**
 * Read the open job: `__NEXT_DATA__` on the detail document, or fetch `/jobs/info/:id`
 * when the list overlay has no JSON, then fill gaps from the DOM. Salary is carried
 * from the list card when the detail page omits it.
 */
export async function readJobRightRecord(ctx) {
  const page = await ctx.call("html");
  const html = page?.html || "";
  const url = page?.url || "";
  const jobUrl = hasNextDataJob(html) ? url : jobInfoUrlFrom(html, url) || url;
  const jobId = jobIdFromUrl(jobUrl);
  const cardSalary = salaryFromJobCard(html, jobId);
  if (hasNextDataJob(html)) return parseDetail(html, url, { salary: cardSalary });
  if (!jobUrl || jobUrl === url) return parseDetail(html, url, { salary: cardSalary });
  const fetched = await ctx.call("fetch", { url: jobUrl });
  if (!fetched?.html) return parseDetail(html, url, { salary: cardSalary });
  return parseDetail(fetched.html, fetched.url || jobUrl, { salary: cardSalary });
}
