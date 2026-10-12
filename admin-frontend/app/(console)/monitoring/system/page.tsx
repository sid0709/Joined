import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/nav";

/** The old System URL. Overview replaced it. */
export default function SystemMonitoringPage() {
  redirect(ROUTES.monitoring);
}
