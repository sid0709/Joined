import type { Metadata } from "next";
import { EarnView } from "@/components/site/earn-view";
import { loadSession } from "@/lib/auth/session";
import { EARN_PAGE } from "@/lib/routes";
import { loadMeta } from "@/lib/scout/load";

export const metadata: Metadata = {
  title: "How scouts earn",
  description: EARN_PAGE.description,
};

export default async function EarnPage() {
  const [session, meta] = await Promise.all([loadSession(), loadMeta()]);
  return <EarnView meta={meta} signedIn={Boolean(session)} />;
}
