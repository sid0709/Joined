"use client";

import React from "react";

import { BidderWorkspaceProvider } from "@/src/candidate/context/BidderWorkspaceContext";
import { HunterProvider } from "@/src/client/context/HunterContext";
import { MockAuthProvider } from "@/src/shared/auth/MockAuthContext";
import { BidderProvider } from "@/src/shared/bidder/BidderContext";
import { JobRoomsProvider } from "@/src/shared/job-rooms/JobRoomsContext";

export function MarketplaceProviders({ children }: { children: React.ReactNode }) {
  return (
    <MockAuthProvider>
      <JobRoomsProvider>
        <BidderProvider>
          <BidderWorkspaceProvider>
            <HunterProvider>{children}</HunterProvider>
          </BidderWorkspaceProvider>
        </BidderProvider>
      </JobRoomsProvider>
    </MockAuthProvider>
  );
}
