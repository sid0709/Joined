import type { Metadata } from "next";

import { BidderOnboardingView } from "@/src/candidate/components/BidderOnboardingView";

export const metadata: Metadata = {
  title: "Bidder onboarding",
};

export default function BidderOnboardingPage() {
  return <BidderOnboardingView />;
}
