import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/nav";

/** DeepSeek settings moved into Settings → AI Model. */
export default function DeepSeekSettingsRedirect() {
  redirect(ROUTES.aiModel);
}
