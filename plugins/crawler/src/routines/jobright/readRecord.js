import { jobInfoUrlFrom, parseDetail } from "./parseDetail.js";
import { hasNextDataJob } from "./parseNextData.js";

/**
 * Read the open job: `__NEXT_DATA__` on the detail document, or fetch `/jobs/info/:id`
 * when the list overlay has no JSON, then fill gaps from the DOM.
 */
export async function readJobRightRecord(ctx) {
  const page = await ctx.call("html");
  const html = page?.html || "";
  const url = page?.url || "";
  if (hasNextDataJob(html)) return parseDetail(html, url);
  const jobUrl = jobInfoUrlFrom(html, url);
  if (!jobUrl) return parseDetail(html, url);
  const fetched = await ctx.call("fetch", { url: jobUrl });
  if (!fetched?.html) return parseDetail(html, url);
  return parseDetail(fetched.html, fetched.url || jobUrl);
}
