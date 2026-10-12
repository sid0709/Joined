import type { Metadata } from "next";
import { IncidentBoard } from "@/components/monitoring/incident-board";
import { joinedWebUrl } from "@/lib/server/env";
import { JOINED_STATUS_PATH } from "@/lib/status-incidents";

export const metadata: Metadata = { title: "Status incidents" };

export default function StatusIncidentsPage() {
  const web = joinedWebUrl();
  return <IncidentBoard statusPageUrl={web ? `${web}${JOINED_STATUS_PATH}` : null} />;
}
