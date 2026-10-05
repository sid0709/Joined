import { handlePasswordReset } from "@/lib/auth/email-api";
import { joinedApiUrl } from "@/lib/config";

export async function POST(request: Request) {
  return handlePasswordReset(request, joinedApiUrl());
}
