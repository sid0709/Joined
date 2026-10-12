import type { Metadata } from "next";
import { DataPage } from "@/components/monitoring/data-page";

export const metadata: Metadata = { title: "Data" };

export default function Page() {
  return <DataPage />;
}
