"use client";

import { Divider, GridColumn, GridSystem, Heading, Icon, Text, icons } from "sid-ui";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { BidderOnboardingState } from "@/src/shared/types/bidder";

import { useBidderContext } from "@/src/shared/bidder/BidderContext";
import { Badge, Banner, Button, Card, PageBody, Stack } from "@/src/shared/marketplace-ui";

type OnboardingStep = {
  key: keyof BidderOnboardingState;
  title: string;
  eyebrow: string;
  description: string;
  detail: string;
  action: string;
  completeLabel: string;
};

const STEPS: OnboardingStep[] = [
  {
    key: "identity",
    title: "Identity verification",
    eyebrow: "Trust and safety",
    description: "Verify the person behind the bidder account before receiving managed work.",
    detail: "Tier 3 verification is required before identity-sensitive workflows can be assigned.",
    action: "Review verification",
    completeLabel: "Verified",
  },
  {
    key: "skillsTest",
    title: "Skills test",
    eyebrow: "Quality gate",
    description: "Complete a graded sample application so your quality level is measurable.",
    detail:
      "The sample checks accurate answers, approved resume use, evidence capture, and escalation judgment.",
    action: "Open skills test",
    completeLabel: "Passed",
  },
  {
    key: "taxInfo",
    title: "Tax information",
    eyebrow: "Payout setup",
    description: "Add the information required for compliant earnings and payout processing.",
    detail:
      "This demo only shows the setup state. Production tax collection belongs to the payments service.",
    action: "Review tax setup",
    completeLabel: "Complete",
  },
  {
    key: "terms",
    title: "Terms and participation",
    eyebrow: "Agreement",
    description: "Review the bidder terms, privacy expectations, and account responsibilities.",
    detail:
      "Accepting terms does not permit fabricated experience, employer communication, or interview attendance.",
    action: "Review terms",
    completeLabel: "Accepted",
  },
  {
    key: "rulesTraining",
    title: "Rules training",
    eyebrow: "Required training",
    description:
      "Learn the rules that protect clients, applicants, and the quality of every submission.",
    detail: "Finish the short module before claiming live applications from the work queue.",
    action: "Continue training",
    completeLabel: "Complete",
  },
];

function isComplete(step: OnboardingStep, state: BidderOnboardingState) {
  const value = state[step.key];
  return value === "verified" || value === "passed" || value === "complete" || value === "accepted";
}

function statusLabel(step: OnboardingStep, state: BidderOnboardingState) {
  if (isComplete(step, state)) return step.completeLabel;
  return state[step.key] === "in_progress" || state[step.key] === "in_review"
    ? "In progress"
    : "Not started";
}

export function BidderOnboardingView() {
  const router = useRouter();
  const { onboarding, performance, updateOnboardingStep } = useBidderContext();
  const [activeKey, setActiveKey] = useState<keyof BidderOnboardingState>(
    () => STEPS.find((step) => !isComplete(step, onboarding))?.key ?? STEPS[0].key,
  );
  const completedCount = useMemo(
    () => STEPS.filter((step) => isComplete(step, onboarding)).length,
    [onboarding],
  );
  const progress = Math.round((completedCount / STEPS.length) * 100);
  const activeStep = STEPS.find((step) => step.key === activeKey) ?? STEPS[0];
  const activeComplete = isComplete(activeStep, onboarding);

  const completeActiveStep = () => {
    const nextValue: BidderOnboardingState[typeof activeKey] =
      activeKey === "identity"
        ? "verified"
        : activeKey === "skillsTest"
          ? "passed"
          : activeKey === "taxInfo"
            ? "complete"
            : activeKey === "terms"
              ? "accepted"
              : "complete";
    updateOnboardingStep(activeKey, nextValue);
  };

  const continueTraining = () => {
    if (activeKey === "rulesTraining" && onboarding.rulesTraining === "not_started") {
      updateOnboardingStep("rulesTraining", "in_progress");
      return;
    }
    completeActiveStep();
  };

  const advanceToNextStep = () => {
    const currentIndex = STEPS.findIndex((step) => step.key === activeKey);
    if (currentIndex === STEPS.length - 1) {
      router.push("/marketplace/candidate/dashboard");
      return;
    }
    setActiveKey(STEPS[currentIndex + 1].key);
  };

  const handlePrimaryAction = () => {
    if (activeKey === "rulesTraining" && onboarding.rulesTraining === "not_started") {
      continueTraining();
      return;
    }
    if (!activeComplete) completeActiveStep();
    advanceToNextStep();
  };

  const currentIndex = STEPS.findIndex((step) => step.key === activeKey);
  const primaryLabel =
    activeKey === "rulesTraining" && onboarding.rulesTraining === "not_started"
      ? "Start training"
      : currentIndex === STEPS.length - 1
        ? "Open bidder dashboard"
        : activeComplete
          ? "Continue to next step"
          : "Complete and continue";

  return (
    <PageBody className="marketplace-onboarding-page">
      <Stack gap={24}>
        <div className="marketplace-page-header marketplace-page-intro">
          <div>
            <span className="label text-primary">BIDDER ONBOARDING</span>
            <h1 className="h1">Prepare for trusted application work</h1>
            <p className="body text-ink-muted">
              Complete each step before claiming live applications. Your verification and quality
              signals determine which work you can receive and how your rate progresses.
            </p>
          </div>
          <Badge
            label={`${completedCount}/${STEPS.length} complete`}
            tone={progress === 100 ? "success" : "primary"}
          />
        </div>

        <div className="marketplace-onboarding-notice">
          <Banner
            tone="info"
            title="This is a quality and safety gate"
            description="Joined never asks bidders to invent experience, guess eligibility answers, attend interviews, or communicate with employers as the applicant."
          />
        </div>

        <div className="marketplace-onboarding-grid">
          <GridSystem gap={5} responsiveTo="viewport" align="stretch">
            <GridColumn span="full" md={5} lg={4}>
              <Stack gap={5} height="100%">
                <Card
                  title="Your readiness"
                  meta="Complete all five steps to unlock the work queue."
                  className="marketplace-onboarding-card"
                >
                  <Stack gap={4}>
                    <div className="marketplace-profile-row">
                      <span>Onboarding progress</span>
                      <strong>{progress}%</strong>
                    </div>
                    <div
                      className="marketplace-readiness-meter"
                      aria-label={`Onboarding progress ${progress}%`}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <Divider />
                    <div className="marketplace-profile-row">
                      <span>Current bidder level</span>
                      <Badge label={performance.level} tone="primary" />
                    </div>
                    <div className="marketplace-profile-row">
                      <span>Daily quota after approval</span>
                      <strong>{performance.quota} applications</strong>
                    </div>
                    <div className="marketplace-profile-row">
                      <span>Rules training</span>
                      <Badge
                        label={statusLabel(STEPS[4], onboarding)}
                        tone={isComplete(STEPS[4], onboarding) ? "success" : "primary"}
                      />
                    </div>
                  </Stack>
                </Card>

                <Card
                  title="Onboarding checklist"
                  meta="Select a step to continue where you left off."
                  className="marketplace-onboarding-card marketplace-onboarding-checklist"
                >
                  <Stack gap={2}>
                    {STEPS.map((step, index) => {
                      const complete = isComplete(step, onboarding);
                      const active = step.key === activeKey;
                      return (
                        <button
                          key={step.key}
                          type="button"
                          className={`marketplace-selection-item ${active ? "marketplace-selection-item-active" : ""}`}
                          onClick={() => setActiveKey(step.key)}
                          aria-current={active ? "step" : undefined}
                        >
                          <span className="marketplace-card-footer">
                            <span className="marketplace-inline-actions">
                              <strong>{complete ? "✓" : index + 1}</strong>
                              <span>
                                <strong className="body-strong">{step.title}</strong>
                                <span className="caption text-ink-muted">{step.eyebrow}</span>
                              </span>
                            </span>
                            <Badge
                              label={statusLabel(step, onboarding)}
                              tone={complete ? "success" : active ? "primary" : "neutral"}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </Stack>
                </Card>
              </Stack>
            </GridColumn>

            <GridColumn span="full" md={7} lg={8}>
              <Stack gap={5} height="100%">
                <Card
                  title={activeStep.title}
                  meta={`${activeStep.eyebrow} · Step ${currentIndex + 1} of ${STEPS.length}`}
                  className="marketplace-onboarding-card marketplace-onboarding-active-step"
                >
                  <Stack gap={5} height="100%">
                    <Stack gap={2}>
                      <Heading level={2}>{activeStep.description}</Heading>
                      <Text color="secondary" display="block">
                        {activeStep.detail}
                      </Text>
                    </Stack>
                    <div className="marketplace-review-list">
                      <div>
                        <strong className="body-strong">What happens next</strong>
                        <p className="body-sm text-ink-muted">
                          {activeKey === "rulesTraining"
                            ? "Review the rules, confirm each principle, and finish the training acknowledgement."
                            : "Review the information, complete the demo step, and keep the status visible for future audit history."}
                        </p>
                      </div>
                      <div>
                        <strong className="body-strong">Why this matters</strong>
                        <p className="body-sm text-ink-muted">
                          {activeKey === "skillsTest"
                            ? "Quality results influence your level, quota, and future earning opportunities."
                            : "Every onboarding decision becomes part of the bidder trust record."}
                        </p>
                      </div>
                    </div>
                    <div className="marketplace-inline-actions marketplace-onboarding-actions">
                      {!activeComplete ? (
                        <Button type="button" variant="primary" onClick={handlePrimaryAction}>
                          {primaryLabel}
                        </Button>
                      ) : (
                        <Button type="button" variant="primary" onClick={advanceToNextStep}>
                          {primaryLabel}
                        </Button>
                      )}
                      {currentIndex > 0 ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setActiveKey(STEPS[currentIndex - 1].key)}
                        >
                          Previous step
                        </Button>
                      ) : null}
                    </div>
                  </Stack>
                </Card>

                <Card
                  title="Bidder rules"
                  meta="These rules apply to every application workspace."
                  className="marketplace-onboarding-card"
                >
                  <Stack gap={3}>
                    {[
                      "Use only approved facts and resumes.",
                      "Ask the client instead of guessing eligibility answers.",
                      "Never attend interviews or speak as the applicant.",
                      "Attach evidence to every submitted application.",
                    ].map((rule) => (
                      <div key={rule} className="marketplace-inline-actions">
                        <Icon icon={icons.check} />
                        <Text type="supporting">{rule}</Text>
                      </div>
                    ))}
                  </Stack>
                </Card>
              </Stack>
            </GridColumn>
          </GridSystem>
        </div>

        {progress === 100 ? (
          <Banner
            tone="success"
            title="Onboarding complete"
            description="You are ready to enter the bidder dashboard and claim eligible application work."
          />
        ) : (
          <Text type="supporting" color="secondary" display="block">
            Complete the remaining steps to unlock the Work Queue. You can return here anytime from
            the bidder navigation.
          </Text>
        )}
      </Stack>
    </PageBody>
  );
}
