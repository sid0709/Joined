import { writeSessionCookie } from "@/lib/auth/cookie";
import { handleEmailSignin } from "@/lib/auth/email-api";
import { joinedApiUrl } from "@/lib/config";

export async function POST(request: Request) {
  return handleEmailSignin(request, joinedApiUrl(), writeSessionCookie);
}
