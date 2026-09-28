import type { Metadata } from "next";
import { SubmitJobForm } from "@/components/submit/submit-job-form";

export const metadata: Metadata = { title: "Submit a job" };

export default function SubmitPage() {
  return <SubmitJobForm />;
}
