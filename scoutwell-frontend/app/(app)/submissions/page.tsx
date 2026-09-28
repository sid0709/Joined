import type { Metadata } from "next";
import { SubmissionsWorkspace } from "@/components/submissions/submissions-workspace";

export const metadata: Metadata = { title: "My submissions" };

export default function SubmissionsPage() {
  return <SubmissionsWorkspace />;
}
