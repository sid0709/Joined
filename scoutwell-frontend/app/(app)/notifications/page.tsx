import type { Metadata } from "next";
import { NotificationsWorkspace } from "@/components/notifications/notifications-workspace";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <NotificationsWorkspace />;
}
