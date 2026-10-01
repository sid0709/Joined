"use client";

import { Glyph } from "@joined/design-system";
import Link from "next/link";
import { useState } from "react";

import type { Assessment } from "@/src/candidate/types/workspace";

import { ACCOUNT_LINKS, SectionNav } from "@/src/candidate/components/ui/SectionNav";
import { AssessmentBadge } from "@/src/candidate/components/ui/StatusBadges";
import { useBidderWorkspace } from "@/src/candidate/context/BidderWorkspaceContext";
import { ASSESSMENT_QUIZ } from "@/src/candidate/data/account";
import { BOARD_TASKS } from "@/src/candidate/data/board";
import { PageHeader } from "@/src/shared/kit/PageHeader";
import { Panel } from "@/src/shared/kit/Panel";
import { StatCard } from "@/src/shared/kit/StatCard";
import { longDate } from "@/src/shared/lib/format";
import { Banner, Button, Modal, PageBody } from "@/src/shared/marketplace-ui";
import { BIDDER_ROUTES } from "@/src/shared/routes/bidder";

export function AssessmentsView() {
  const { assessments } = useBidderWorkspace();
  const [taking, setTaking] = useState<Assessment | null>(null);
  const passed = assessments.filter((item) => item.status === "passed");

  return (
    <PageBody>
      <div className="hx-page">
        <PageHeader
          eyebrow="Assessments"
          title="Prove your skills, unlock better tasks"
          description="Short practical assessments show hunters you know each application system. Passing one unlocks the packages and tasks that require it."
        />
        <SectionNav label="Account sections" links={ACCOUNT_LINKS} />

        <div className="hx-grid hx-grid-stats">
          <StatCard
            label="Passed"
            value={`${passed.length}/${assessments.length}`}
            icon="check"
            tone="success"
            footnote="Assessments completed"
          />
          <StatCard
            label="Tasks unlocked"
            value={
              BOARD_TASKS.filter(
                (task) =>
                  !task.requiredAssessmentId ||
                  passed.some((item) => item.id === task.requiredAssessmentId),
              ).length
            }
            icon="lock"
            footnote={`of ${BOARD_TASKS.length} on the board`}
          />
          <StatCard
            label="Pass mark"
            value="67%"
            icon="star"
            tone="warning"
            footnote="Retake as often as you like"
          />
        </div>

        <div className="hx-grid hx-grid-2">
          {assessments.map((assessment) => {
            const gated = BOARD_TASKS.filter((task) => task.requiredAssessmentId === assessment.id);
            return (
              <Panel
                key={assessment.id}
                title={assessment.title}
                subtitle={`${assessment.ats} · ${assessment.questions} questions · about ${assessment.minutes} min`}
                actions={<AssessmentBadge status={assessment.status} />}
              >
                <div className="hx-stack">
                  <div className="bx-callout">
                    <span className="hx-small hx-muted">Unlocks</span>
                    <strong>{assessment.unlocks}</strong>
                  </div>
                  {assessment.takenAt && (
                    <span className="hx-small hx-muted">
                      Last attempt {longDate(assessment.takenAt)}
                      {assessment.score !== undefined && ` · score ${assessment.score}%`}
                    </span>
                  )}
                  {gated.length > 0 && (
                    <div className="hx-stack hx-stack-sm">
                      <span className="hx-eyebrow">Tasks that need it</span>
                      {gated.map((task) => (
                        <Link
                          key={task.id}
                          href={BIDDER_ROUTES.task(task.id)}
                          className="hx-link hx-small"
                        >
                          {task.title}
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="hx-row">
                    <Button
                      variant={assessment.status === "passed" ? "secondary" : "primary"}
                      label={assessment.status === "available" ? "Start assessment" : "Retake"}
                      onClick={() => setTaking(assessment)}
                    />
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>

      <Modal
        open={taking !== null}
        onClose={() => setTaking(null)}
        title={taking?.title ?? "Assessment"}
      >
        {taking && <Quiz key={taking.id} assessment={taking} onClose={() => setTaking(null)} />}
      </Modal>
    </PageBody>
  );
}

function Quiz({ assessment, onClose }: { assessment: Assessment; onClose: () => void }) {
  const { submitAssessment } = useBidderWorkspace();
  const questions = ASSESSMENT_QUIZ[assessment.id] ?? [];
  const [answers, setAnswers] = useState<number[]>(questions.map(() => -1));
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const complete = answers.every((answer) => answer >= 0);

  if (result) {
    return (
      <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
        <Banner
          tone={result.passed ? "success" : "danger"}
          title={result.passed ? `Passed with ${result.score}%` : `You scored ${result.score}%`}
          description={
            result.passed
              ? "The tasks that need this assessment are now unlocked."
              : "You need 67% to pass. Review the answers and try again."
          }
        />
        <Button variant="primary" label="Done" onClick={onClose} />
      </div>
    );
  }

  return (
    <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
      {questions.map((question, index) => (
        <fieldset key={question.prompt} className="bx-question">
          <legend className="hx-strong">
            {index + 1}. {question.prompt}
          </legend>
          <div className="hx-stack hx-stack-sm">
            {question.options.map((option, optionIndex) => (
              <button
                key={option}
                type="button"
                className="hx-choice"
                aria-pressed={answers[index] === optionIndex}
                onClick={() =>
                  setAnswers((current) =>
                    current.map((value, i) => (i === index ? optionIndex : value)),
                  )
                }
              >
                <span className="hx-row" style={{ flexWrap: "nowrap" }}>
                  {answers[index] === optionIndex && <Glyph name="check" size="1em" />}
                  {option}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="hx-row hx-row-between">
        <Button variant="ghost" label="Cancel" onClick={onClose} />
        <Button
          variant="primary"
          label="Submit answers"
          disabled={!complete}
          onClick={() => setResult(submitAssessment(assessment.id, answers))}
        />
      </div>
    </div>
  );
}
