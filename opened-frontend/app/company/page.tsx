import type { Metadata } from "next";
import { CompanyHome } from "@/components/company/overview/company-home";
import { loadSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Hiring" };

export default async function CompanyHomePage() {
  const session = await loadSession();
  const company = session?.company;
  const firstName = session?.user.name.split(" ")[0] ?? "there";
  if (!company) return null;
  return <CompanyHome greeting={`Welcome back, ${firstName}`} company={company} />;
}
