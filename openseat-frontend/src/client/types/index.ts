import { BudgetType, ExperienceLevel } from "@/src/shared/types/job-room";

export interface ClientJobPost {
  title: string;
  sourceCompany: string;
  sourceUrl: string;
  applicationDeadline: string;
  budgetType: BudgetType;
  rateOrBudgetRangeText: string;
  experienceLevelRequired: ExperienceLevel;
  durationEstimateText: string;
  weeklyCommitmentText: string;
  descriptionParagraph: string;
  skillsTags: string[];
}
