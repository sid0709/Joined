"use client";

import React from "react";

import { MockAuthProvider } from "@/src/shared/auth/MockAuthContext";
import { BidderProvider } from "@/src/shared/bidder/BidderContext";
import { BidderWorkflowProvider } from "@/src/shared/bidder/BidderWorkflowContext";
import { JobRoomsProvider } from "@/src/shared/job-rooms/JobRoomsContext";

export function MarketplaceProviders({ children }: { children: React.ReactNode }) {
  return (
    <MockAuthProvider>
      <JobRoomsProvider>
        <BidderProvider>
          <BidderWorkflowProvider>{children}</BidderWorkflowProvider>
        </BidderProvider>
      </JobRoomsProvider>
    </MockAuthProvider>
  );
}
