"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type {
  BidderApplication,
  BidderApplicationStatus,
  BidderEarningsSnapshot,
  BidderOnboardingState,
  BidderPerformanceSnapshot,
} from "@/src/shared/types/bidder";

import {
  INITIAL_BIDDER_APPLICATIONS,
  INITIAL_BIDDER_EARNINGS,
  INITIAL_BIDDER_ONBOARDING,
  INITIAL_BIDDER_PERFORMANCE,
} from "@/src/shared/data/bidderData";

interface BidderContextValue {
  applications: BidderApplication[];
  queue: BidderApplication[];
  onboarding: BidderOnboardingState;
  performance: BidderPerformanceSnapshot;
  earnings: BidderEarningsSnapshot;
  updateOnboardingStep: <T extends keyof BidderOnboardingState>(
    step: T,
    value: BidderOnboardingState[T],
  ) => void;
  claimNext: () => string | null;
  claimApplication: (applicationId: string) => void;
  releaseClaim: (applicationId: string) => void;
  logAction: (
    applicationId: string,
    action: BidderApplication["bidLog"][number]["action"],
    detail?: string,
  ) => void;
  askClient: (applicationId: string, questions: string[]) => void;
  submitApplication: (
    applicationId: string,
    evidenceKeys: string[],
    uploadedResumeSha256: string,
  ) => void;
  failApplication: (applicationId: string, reason: string) => void;
}

const BidderContext = createContext<BidderContextValue | undefined>(undefined);

function updateApplication(
  setApplications: React.Dispatch<React.SetStateAction<BidderApplication[]>>,
  applicationId: string,
  update: (application: BidderApplication) => BidderApplication,
) {
  setApplications((current) =>
    current.map((application) =>
      application.id === applicationId ? update(application) : application,
    ),
  );
}

export function BidderProvider({ children }: { children: React.ReactNode }) {
  const [applications, setApplications] = useState(INITIAL_BIDDER_APPLICATIONS);
  const [onboarding, setOnboarding] = useState(INITIAL_BIDDER_ONBOARDING);
  const [performance] = useState(INITIAL_BIDDER_PERFORMANCE);
  const [earnings] = useState(INITIAL_BIDDER_EARNINGS);

  const claimApplication = (applicationId: string) => {
    updateApplication(setApplications, applicationId, (application) => {
      if (application.status !== "queued") return application;
      const claimedAt = new Date().toISOString();
      const claimExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      return {
        ...application,
        status: "claimed",
        claimedAt,
        claimExpiresAt,
        bidLog: [
          ...application.bidLog,
          {
            id: `log-${Date.now()}`,
            action: "opened",
            label: "Application claimed",
            createdAt: claimedAt,
          },
        ],
      };
    });
  };

  const claimNext = () => {
    const next = applications.find((application) => application.status === "queued");
    if (!next) return null;
    claimApplication(next.id);
    return next.id;
  };

  const releaseClaim = (applicationId: string) => {
    updateApplication(setApplications, applicationId, (application) =>
      application.status === "claimed"
        ? { ...application, status: "queued", claimedAt: undefined, claimExpiresAt: undefined }
        : application,
    );
  };

  const logAction = (
    applicationId: string,
    action: BidderApplication["bidLog"][number]["action"],
    detail?: string,
  ) => {
    updateApplication(setApplications, applicationId, (application) => ({
      ...application,
      bidLog: [
        ...application.bidLog,
        {
          id: `log-${Date.now()}`,
          action,
          label:
            action === "opened"
              ? "Official job link opened"
              : action === "resume_uploaded"
                ? "Assigned resume uploaded"
                : action === "evidence_captured"
                  ? "Submission evidence captured"
                  : action === "submitted"
                    ? "Application submitted"
                    : action === "asked_client"
                      ? "Client input requested"
                      : "QA failure recorded",
          detail,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  };

  const askClient = (applicationId: string, questions: string[]) => {
    const cleaned = questions.map((question) => question.trim()).filter(Boolean);
    if (!cleaned.length) return;
    updateApplication(setApplications, applicationId, (application) => ({
      ...application,
      status: "needs_client_input",
      clientQuestions: [...application.clientQuestions, ...cleaned],
      bidLog: [
        ...application.bidLog,
        {
          id: `log-${Date.now()}`,
          action: "asked_client",
          label: "Client input requested",
          detail: cleaned.join(" "),
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  };

  const submitApplication = (
    applicationId: string,
    evidenceKeys: string[],
    uploadedResumeSha256: string,
  ) => {
    updateApplication(setApplications, applicationId, (application) => {
      const hasEvidence = evidenceKeys.length > 0;
      const hasResume = Boolean(uploadedResumeSha256.trim());
      const resumeMatches = uploadedResumeSha256.trim() === application.assignedResumeSha256;
      if (!hasEvidence || !hasResume || !resumeMatches) {
        return {
          ...application,
          status: "qa_failed",
          qaNote: !resumeMatches
            ? "The uploaded resume hash does not match the assigned resume version."
            : "Submission requires evidence and an assigned resume hash.",
          bidLog: [
            ...application.bidLog,
            {
              id: `log-${Date.now()}`,
              action: "qa_failed",
              label: "Submission blocked by QA checks",
              detail: !resumeMatches
                ? "Resume hash mismatch. Use the assigned resume version."
                : "Evidence or resume hash is missing.",
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
      const submittedAt = new Date().toISOString();
      return {
        ...application,
        status: "submitted",
        evidenceFiles: [...new Set([...application.evidenceFiles, ...evidenceKeys])],
        checklist: application.checklist.map((item) => ({ ...item, complete: true })),
        bidLog: [
          ...application.bidLog,
          {
            id: `log-${Date.now()}`,
            action: "submitted",
            label: "Application submitted",
            createdAt: submittedAt,
          },
          {
            id: `log-${Date.now() + 1}`,
            action: "evidence_captured",
            label: "Submission evidence captured",
            createdAt: submittedAt,
          },
        ],
      };
    });
  };

  const failApplication = (applicationId: string, reason: string) => {
    updateApplication(setApplications, applicationId, (application) => ({
      ...application,
      status: "qa_failed",
      qaNote: reason.trim() || "QA review returned this application for correction.",
      bidLog: [
        ...application.bidLog,
        {
          id: `log-${Date.now()}`,
          action: "qa_failed",
          label: "QA review returned application",
          detail: reason.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  };

  const updateOnboardingStep = <T extends keyof BidderOnboardingState>(
    step: T,
    value: BidderOnboardingState[T],
  ) => {
    setOnboarding((current) => ({ ...current, [step]: value }));
  };

  const queue = useMemo(
    () =>
      applications.filter((application) =>
        [
          "queued",
          "claimed",
          "preparing",
          "needs_client_input",
          "awaiting_client_approval",
        ].includes(application.status),
      ),
    [applications],
  );

  return (
    <BidderContext.Provider
      value={{
        applications,
        queue,
        onboarding,
        performance,
        earnings,
        updateOnboardingStep,
        claimNext,
        claimApplication,
        releaseClaim,
        logAction,
        askClient,
        submitApplication,
        failApplication,
      }}
    >
      {children}
    </BidderContext.Provider>
  );
}

export function useBidderContext() {
  const context = useContext(BidderContext);
  if (!context) throw new Error("useBidderContext must be used within a BidderProvider.");
  return context;
}

export function bidderStatusLabel(status: BidderApplicationStatus) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
