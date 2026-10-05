import type { Metadata } from "next";
import { Sticky } from "sid-ui";
import { CompanyMessages } from "@/components/messages/company-messages";
import { CONTENT_PADDING } from "@/components/shell/app-frame";
import { loadCompanyThreads } from "@/lib/me/load";

export const metadata: Metadata = { title: "Company messages" };
export const dynamic = "force-dynamic";

export default async function CompanyMessagesPage() {
  const threads = await loadCompanyThreads();
  return (
    <Sticky fill offset={CONTENT_PADDING}>
      <CompanyMessages threads={threads} />
    </Sticky>
  );
}
