import { Suspense } from "react";
import { ListSkeleton } from "@/components/list-skeleton";
import { CompaniesBrowser } from "@/components/companies/companies-browser";

export const metadata = {
  title: "Companies",
};

export default function CompaniesPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <CompaniesBrowser />
    </Suspense>
  );
}
