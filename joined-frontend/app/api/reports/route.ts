import { forwardJoined } from "@/lib/me/forward";

/** Candidate session → joined-backend POST /v1/reports. */
export function POST(request: Request) {
  return forwardJoined(request, "/v1/reports");
}
