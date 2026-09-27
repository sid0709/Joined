import { redirect } from "next/navigation";

export default function ClientDashboardPage() {
  redirect("/marketplace/client/jobs");
}
