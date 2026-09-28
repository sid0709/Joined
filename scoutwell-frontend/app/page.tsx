import type { Metadata } from "next";
import { AppFrame } from "@/components/shell/app-frame";
import { ScoutHeader } from "@/components/shell/scout-header";
import { PageContainer } from "@/components/page-container";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = { title: "Scout jobs. Earn on outcomes." };

export default function HomePage() {
  return (
    <AppFrame header={<ScoutHeader />}>
      <PageContainer>
        <LandingPage />
      </PageContainer>
    </AppFrame>
  );
}
