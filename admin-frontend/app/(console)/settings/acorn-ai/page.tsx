import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/nav";

/** Acorn AI settings moved into Settings → AI Model. */
export default function AcornAISettingsRedirect() {
  redirect(ROUTES.aiModel);
}
