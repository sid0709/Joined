import type { Metadata } from "next";
import { TrafficPage } from "@/components/monitoring/traffic-page";

export const metadata: Metadata = { title: "Traffic" };

export default function Page() {
  return <TrafficPage />;
}
