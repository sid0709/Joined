import type {
  BoardHunter,
  BoardTask,
  Engagement,
  EngagementStatus,
  HiringStage,
} from "@/src/candidate/types/workspace";

import { money } from "@/src/shared/lib/format";

export interface HunterReply {
  body: string;
  status?: EngagementStatus;
  stage?: HiringStage;
  connect?: boolean;
  /** When true the scripted negotiation does not advance. */
  hold?: boolean;
}

const CONNECTED_REPLIES = [
  "Thanks, noted. I'll check it as soon as I'm back at my desk.",
  "Sounds good. Flag anything unusual in Reviews so it's tracked.",
  "Got it. Tell me if you want more links this week.",
];

export function hunterReply(
  task: BoardTask,
  hunter: BoardHunter,
  engagement: Engagement,
  hasRequiredAssessment: boolean,
): HunterReply | null {
  const first = hunter.name.split(" ")[0];
  if (engagement.status === "declined" || engagement.status === "withdrawn") return null;
  if (engagement.status === "connected") {
    return { body: CONNECTED_REPLIES[engagement.replies % CONNECTED_REPLIES.length] };
  }
  if (engagement.replies === 0) {
    return {
      body: `Thanks for reaching out. Can you confirm you can hit about ${task.dailyTarget} links a day and share your recent QA pass rate? I'm ${first}, by the way.`,
      status: "negotiating",
      stage: "screening",
    };
  }
  if (!hasRequiredAssessment) {
    return {
      body: "Before I can connect you I need the assessment for this task completed. You'll find it under Assessments. Message me once you've passed.",
      hold: true,
    };
  }
  const rate = engagement.proposedRates[0]?.rate;
  return {
    body: `That works for me${rate ? `, ${money(rate)} per link is agreed` : ""}. I'm connecting you now and will assign your first batch shortly.`,
    status: "connected",
    stage: "connected",
    connect: true,
  };
}
