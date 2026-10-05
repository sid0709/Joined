import type { Metadata } from "next";
import { ResumeLibrary } from "@/components/workspace/resume/resume-library";

export const metadata: Metadata = { title: "Resume library" };

export default function ResumeLibraryPage() {
  return <ResumeLibrary />;
}
