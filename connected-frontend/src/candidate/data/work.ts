import type { BidderApplication, BidderAssignment, Review } from "@/src/candidate/types/workspace";
import type { ApplicationStatus } from "@/src/shared/types/marketplace";

import { isoAgo, isoAhead, seeded } from "@/src/shared/mock/clock";
import { PACKAGE_BY_ID } from "@/src/shared/mock/packages";
import { POOL_JOBS } from "@/src/shared/mock/pool";

export const BIDDER_ID = "bidder-alex";

const byAts = (...ats: string[]) => POOL_JOBS.filter((job) => ats.includes(job.ats));
const GREENHOUSE = byAts("Greenhouse");
const STARTUP = POOL_JOBS.filter((job) => job.ats === "Lever" || job.ats === "Ashby").sort((a, b) =>
  a.id.localeCompare(b.id),
);
const WORKDAY = byAts("Workday");

interface Plan {
  passed: number;
  returned: number;
  submitted: number;
  inProgress: number;
  queued: number;
}

interface AssignmentSeed {
  id: string;
  engagementId: string;
  taskId: string;
  packageId: string;
  rate: number;
  jobs: string[];
  assignedDaysAgo: number;
  dueDaysAhead: number;
  dailyTarget: number;
  status: BidderAssignment["status"];
  note: string;
  plan: Plan;
  issues: string[];
}

const SEEDS: AssignmentSeed[] = [
  {
    id: "asg-ops-0",
    engagementId: "eng-ops",
    taskId: "task-ops-volume",
    packageId: "pkg-greenhouse",
    rate: 0.75,
    jobs: GREENHOUSE.slice(0, 20).map((job) => job.id),
    assignedDaysAgo: 27,
    dueDaysAhead: -20,
    dailyTarget: 10,
    status: "completed",
    note: "Trial batch. Completed with a clean QA record.",
    plan: { passed: 20, returned: 0, submitted: 0, inProgress: 0, queued: 0 },
    issues: [],
  },
  {
    id: "asg-ops-1",
    engagementId: "eng-ops",
    taskId: "task-ops-volume",
    packageId: "pkg-greenhouse",
    rate: 0.75,
    jobs: GREENHOUSE.slice(20, 52).map((job) => job.id),
    assignedDaysAgo: 9,
    dueDaysAhead: 3,
    dailyTarget: 3,
    status: "active",
    note: "Weekly Greenhouse drop. Post a short summary in chat at the end of each day.",
    plan: { passed: 24, returned: 2, submitted: 3, inProgress: 2, queued: 1 },
    issues: [
      "Confirmation screenshot missing from the evidence note.",
      "Duplicate company: already applied within 30 days.",
    ],
  },
  {
    id: "asg-startup-0",
    engagementId: "eng-startup",
    taskId: "task-startup-desk",
    packageId: "pkg-startup",
    rate: 1.4,
    jobs: STARTUP.slice(18, 36).map((job) => job.id),
    assignedDaysAgo: 24,
    dueDaysAhead: -17,
    dailyTarget: 3,
    status: "completed",
    note: "Paid trial batch. Approved with strong notes on answer tone.",
    plan: { passed: 18, returned: 0, submitted: 0, inProgress: 0, queued: 0 },
    issues: [],
  },
  {
    id: "asg-startup-1",
    engagementId: "eng-startup",
    taskId: "task-startup-desk",
    packageId: "pkg-startup",
    rate: 1.4,
    jobs: STARTUP.slice(0, 18).map((job) => job.id),
    assignedDaysAgo: 8,
    dueDaysAhead: 2,
    dailyTarget: 2,
    status: "active",
    note: "Verify portfolio and LinkedIn links before submitting. Calibrate answer tone on the first three.",
    plan: { passed: 9, returned: 2, submitted: 3, inProgress: 1, queued: 3 },
    issues: [
      "LinkedIn field rejected the profile URL. Use the full https://www.linkedin.com/in/ link.",
      "Portfolio link returned a 404 when the form was submitted.",
    ],
  },
  {
    id: "asg-fin-1",
    engagementId: "eng-fin",
    taskId: "task-finance-desk",
    packageId: "pkg-workday",
    rate: 1.45,
    jobs: WORKDAY.slice(0, 14).map((job) => job.id),
    assignedDaysAgo: 7,
    dueDaysAhead: 4,
    dailyTarget: 1,
    status: "active",
    note: "Use the shared vault for employer accounts. Correct resume parsing before every submit.",
    plan: { passed: 6, returned: 2, submitted: 2, inProgress: 1, queued: 3 },
    issues: [
      "Resume parsing put the job title in the employer field. Correct it before submitting.",
      "Work history dates were left as parsed (2022–2022).",
    ],
  },
];

function buildApplications(): BidderApplication[] {
  const random = seeded(2718);
  const all: BidderApplication[] = [];
  for (const seed of SEEDS) {
    const { plan } = seed;
    const settled = plan.passed + plan.returned;
    const every = plan.returned ? Math.floor(settled / plan.returned) : 0;
    let returned = 0;
    const minutes = PACKAGE_BY_ID.get(seed.packageId)?.minutesPerLink ?? 8;
    seed.jobs.forEach((jobId, index) => {
      let status: ApplicationStatus;
      if (index < settled) {
        const isReturned = every > 0 && returned < plan.returned && index % every === every - 1;
        if (isReturned) returned += 1;
        status = isReturned ? "returned" : "qa_passed";
      } else if (index < settled + plan.submitted) status = "submitted";
      else if (index < settled + plan.submitted + plan.inProgress) status = "in_progress";
      else status = "queued";

      let updatedAt = isoAgo(seed.assignedDaysAgo);
      if (index < settled) {
        const span = Math.max(1, seed.assignedDaysAgo - (status === "qa_passed" ? 1 : 0));
        const daysAgo = span - Math.floor((index / settled) * (span - 1));
        updatedAt = isoAgo(daysAgo, Math.floor(random() * 9));
      } else if (status === "submitted") updatedAt = isoAgo(0, 1 + Math.floor(random() * 20));
      else if (status === "in_progress") updatedAt = isoAgo(0, 1 + Math.floor(random() * 3));

      const job = POOL_JOBS.find((item) => item.id === jobId);
      const started = status !== "queued" && status !== "in_progress";
      all.push({
        id: `${seed.id}-app-${String(index + 1).padStart(2, "0")}`,
        assignmentId: seed.id,
        taskId: seed.taskId,
        packageId: seed.packageId,
        jobId,
        bidderId: BIDDER_ID,
        status,
        updatedAt,
        minutesSpent: started
          ? Math.max(3, Math.round(minutes * (0.8 + random() * 0.5)))
          : undefined,
        confirmation: started
          ? `CNF-${(job?.company ?? "OS").slice(0, 2).toUpperCase()}-${1000 + index * 37 + (seed.rate > 1 ? 400 : 0)}`
          : undefined,
        evidenceNote: started ? "Confirmation page screenshot attached." : undefined,
        issue: status === "returned" ? seed.issues[(returned - 1) % seed.issues.length] : undefined,
      });
    });
  }
  return all;
}

export const INITIAL_APPLICATIONS: BidderApplication[] = buildApplications();

export const INITIAL_ASSIGNMENTS: BidderAssignment[] = SEEDS.map((seed) => ({
  id: seed.id,
  engagementId: seed.engagementId,
  taskId: seed.taskId,
  packageId: seed.packageId,
  rate: seed.rate,
  jobIds: seed.jobs,
  assignedAt: isoAgo(seed.assignedDaysAgo),
  dueAt: seed.dueDaysAhead >= 0 ? isoAhead(seed.dueDaysAhead) : isoAgo(-seed.dueDaysAhead),
  dailyTarget: seed.dailyTarget,
  status: seed.status,
  note: seed.note,
}));

function buildReviews(): Review[] {
  const reviews: Review[] = [];
  let approvedCounter = 0;
  for (const application of INITIAL_APPLICATIONS) {
    const job = POOL_JOBS.find((item) => item.id === application.jobId);
    const label = job ? `${job.company} · ${job.title}` : application.jobId;
    if (application.status === "returned") {
      const first = reviews.filter((review) => review.verdict === "mistake").length === 0;
      reviews.push({
        id: `rev-${application.id}`,
        taskId: application.taskId,
        assignmentId: application.assignmentId,
        applicationId: application.id,
        verdict: "mistake",
        resolution: first ? "acknowledged" : "open",
        rating: 2,
        summary: `Returned: ${label}`,
        detail: application.issue ?? "The application did not meet the QA checklist.",
        tags: ["Needs fix", job?.ats ?? "ATS"],
        at: application.updatedAt,
        thread: [
          {
            id: `${application.id}-c1`,
            sender: "hunter",
            body: "Thanks for the fast turnaround on the rest of this batch. Please correct this one and resubmit today with fresh evidence.",
            at: application.updatedAt,
          },
          ...(first
            ? [
                {
                  id: `${application.id}-c2`,
                  sender: "bidder" as const,
                  body: "Understood, I'll fix this first thing and resubmit with a fresh screenshot.",
                  at: application.updatedAt,
                },
              ]
            : []),
        ],
      });
    } else if (application.status === "qa_passed") {
      approvedCounter += 1;
      if (approvedCounter % 5 === 0) {
        reviews.push({
          id: `rev-${application.id}`,
          taskId: application.taskId,
          assignmentId: application.assignmentId,
          applicationId: application.id,
          verdict: "approved",
          resolution: "closed",
          rating: approvedCounter % 10 === 0 ? 5 : 4,
          summary: `Approved: ${label}`,
          detail:
            "Answers were consistent with the approved bank and the confirmation evidence was complete.",
          tags: ["QA passed", "Evidence complete"],
          at: application.updatedAt,
          thread: [],
        });
      }
    }
  }
  reviews.push(
    {
      id: "rev-praise-1",
      taskId: "task-ops-volume",
      verdict: "praise",
      resolution: "closed",
      rating: 5,
      summary: "Excellent week on the operations desk",
      detail:
        "Twenty-four links in one day with no blockers and clear end-of-day notes. This is exactly the consistency I hoped for.",
      tags: ["Consistent", "Communicative"],
      at: isoAgo(2, 4),
      thread: [
        {
          id: "rev-praise-1-c1",
          sender: "bidder",
          body: "Thank you, Grace! Happy to take more volume if a slot opens.",
          at: isoAgo(2, 3),
        },
      ],
    },
    {
      id: "rev-praise-2",
      taskId: "task-startup-desk",
      verdict: "praise",
      resolution: "closed",
      rating: 5,
      summary: "Answer tone is spot on",
      detail:
        "The short answers on the first three Ashby forms matched my client's voice. I'm going to make this the reference for the desk.",
      tags: ["Quality writing"],
      at: isoAgo(6),
      thread: [],
    },
    {
      id: "rev-warning-1",
      taskId: "task-finance-desk",
      verdict: "warning",
      resolution: "open",
      rating: 3,
      summary: "Pace fell below the daily target on Thursday",
      detail:
        "You submitted 2 links on Thursday against a target of 5. Let me know early if something blocks you so I can pull links or extend the deadline.",
      tags: ["Pace", "Communication"],
      at: isoAgo(4),
      thread: [
        {
          id: "rev-warning-1-c1",
          sender: "hunter",
          body: "No penalty this time, but please flag blockers in chat the same day.",
          at: isoAgo(4),
        },
      ],
    },
  );
  return reviews.sort((a, b) => b.at.localeCompare(a.at));
}

export const INITIAL_REVIEWS: Review[] = buildReviews();
