"use client";

import React from "react";

import { HunterProvider } from "@/src/client/context/HunterContext";
import { MockAuthProvider } from "@/src/shared/auth/MockAuthContext";
import { JobRoomsProvider } from "@/src/shared/job-rooms/JobRoomsContext";

export function MarketplaceProviders({ children }: { children: React.ReactNode }) {
  return (
    <MockAuthProvider>
      <JobRoomsProvider>
        <HunterProvider>{children}</HunterProvider>
      </JobRoomsProvider>
    </MockAuthProvider>
  );
}
