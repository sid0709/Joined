import { PageContainer } from "@openseat/design-system";
import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { AppFrame } from "@/components/shell/app-frame";
import { ScoutHeader } from "@/components/shell/scout-header";
import { loadSession } from "@/lib/auth/session";
import { loadMeta } from "@/lib/scout/load";

export const metadata: Metadata = { title: "Scout jobs. Earn on outcomes." };

export default async function HomePage() {
  const [session, meta] = await Promise.all([loadSession(), loadMeta()]);
  return (
    <AppFrame header={<ScoutHeader user={session?.user ?? null} />}>
      <PageContainer>
        <LandingPage meta={meta} signedIn={Boolean(session)} />
      </PageContainer>
    </AppFrame>
  );
}
