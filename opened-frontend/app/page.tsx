import type { Metadata } from "next";
import { JobBoard } from "@/components/job-board";

export const metadata: Metadata = {
  title: "Jobs",
  description: "Search jobs by title, city, and workplace.",
};

export default function HomePage() {
  return <JobBoard />;
}
