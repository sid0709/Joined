import { handleEmailSignup } from "@/lib/auth/email-api";
import { joinedApiUrl } from "@/lib/config";

export async function POST(request: Request) {
  return handleEmailSignup(request, joinedApiUrl());
}
