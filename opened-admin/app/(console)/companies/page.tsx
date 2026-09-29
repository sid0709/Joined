import { Suspense } from "react";
import { CompaniesBrowser } from "@/components/companies/companies-browser";

export const metadata = {
  title: "Companies",
};

export default function CompaniesPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface" />}>
      <CompaniesBrowser />
    </Suspense>
  );
}
