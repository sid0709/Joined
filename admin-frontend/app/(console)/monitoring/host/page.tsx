import type { Metadata } from "next";
import { HostPage } from "@/components/monitoring/host-page";

export const metadata: Metadata = { title: "Host" };

export default function Page() {
  return <HostPage />;
}
