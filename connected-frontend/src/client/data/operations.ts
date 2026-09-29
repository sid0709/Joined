import type {
  ApplicationRecord,
  ApplicationStatus,
  Assignment,
  Ats,
  Feedback,
} from "@/src/client/types/hunter";

import { isoAgo, MOCK_NOW, MS_PER_DAY, seeded } from "@/src/client/data/clock";
import { PACKAGE_BY_ID } from "@/src/client/data/packages";
import { POOL_JOBS } from "@/src/client/data/pool";

interface AssignmentSpec {
  id: string;
  taskId: string;
  bidderId: string;
  packageId: string;
  /** How many pool links to draw from each application system, in order. */
  draw: Partial<Record<Ats, number>>;
  assignedDaysAgo: number;
  dueInDays: number;
  status: Assignment["status"];
  note: string;
  counts: Partial<Record<ApplicationStatus, number>>;
}

const SPECS: AssignmentSpec[] = [
  {
    id: "asg-maya-current",
    taskId: "task-gh-desk",
    bidderId: "bidder-maya",
    packageId: "pkg-greenhouse",
    draw: { Greenhouse: 24 },
    assignedDaysAgo: 6,
    dueInDays: 1,
    status: "active",
    note: "Thursday batch. Use resume v3 and the approved answer bank.",
    counts: { qa_passed: 14, submitted: 4, returned: 2, failed: 1, in_progress: 2, queued: 1 },
  },
  {
    id: "asg-daniel-current",
    taskId: "task-startup-desk",
    bidderId: "bidder-daniel",
    packageId: "pkg-startup",
    draw: { Ashby: 10, Lever: 6 },
    assignedDaysAgo: 5,
    dueInDays: 2,
    status: "active",
    note: "Verify the portfolio link before each submit.",
    counts: { qa_passed: 8, submitted: 2, returned: 1, failed: 2, in_progress: 1, queued: 2 },
  },
  {
    id: "asg-jordan-current",
    taskId: "task-workday-desk",
    bidderId: "bidder-jordan",
    packageId: "pkg-workday",
    draw: { Workday: 14 },
    assignedDaysAgo: 4,
    dueInDays: 3,
    status: "active",
    note: "Save every employer account in the shared vault.",
    counts: { qa_passed: 6, submitted: 3, returned: 1, in_progress: 1, queued: 3 },
  },
  {
    id: "asg-elena-batch",
    taskId: "task-icims-batch",
    bidderId: "bidder-elena",
    packageId: "pkg-icims",
    draw: { iCIMS: 30 },
    assignedDaysAgo: 9,
    dueInDays: 3,
    status: "active",
    note: "Zipped healthcare batch. Two references per application.",
    counts: { qa_passed: 14, submitted: 4, returned: 2, failed: 3, in_progress: 2, queued: 5 },
  },
  {
    id: "asg-maya-previous",
    taskId: "task-gh-desk",
    bidderId: "bidder-maya",
    packageId: "pkg-greenhouse",
    draw: { Greenhouse: 22 },
    assignedDaysAgo: 17,
    dueInDays: -6,
    status: "completed",
    note: "Monday batch from two weeks ago.",
    counts: { qa_passed: 20, failed: 2 },
  },
  {
    id: "asg-samir-batch",
    taskId: "task-finance-batch",
    bidderId: "bidder-samir",
    packageId: "pkg-workday",
    draw: { Workday: 24 },
    assignedDaysAgo: 31,
    dueInDays: -25,
    status: "completed",
    note: "Q3 finance and analytics roles.",
    counts: { qa_passed: 22, failed: 2 },
  },
];

const ISSUES: Record<"returned" | "failed", string[]> = {
  returned: [
    "Resume version mismatch",
    "Screenshot missing",
    "Wrong start date entered",
    "Salary field left empty",
    "Cover note mentions a different company",
  ],
  failed: [
    "Requires a work sample",
    "Role closed before submit",
    "Requires a licence number",
    "Location not eligible",
  ],
};

function buildAssignments(): Assignment[] {
  const cursors = new Map<Ats, number>();
  const pools = new Map<Ats, string[]>();
  for (const job of POOL_JOBS) pools.set(job.ats, [...(pools.get(job.ats) ?? []), job.id]);

  return SPECS.map((spec) => {
    const jobIds: string[] = [];
    for (const [ats, count] of Object.entries(spec.draw) as [Ats, number][]) {
      const start = cursors.get(ats) ?? 0;
      jobIds.push(...(pools.get(ats) ?? []).slice(start, start + count));
      cursors.set(ats, start + count);
    }
    return {
      id: spec.id,
      taskId: spec.taskId,
      bidderId: spec.bidderId,
      packageId: spec.packageId,
      jobIds,
      assignedAt: isoAgo(spec.assignedDaysAgo),
      dueAt: new Date(MOCK_NOW.getTime() + spec.dueInDays * MS_PER_DAY).toISOString(),
      status: spec.status,
      note: spec.note,
    };
  });
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildApplications(assignments: Assignment[]): ApplicationRecord[] {
  const records: ApplicationRecord[] = [];
  SPECS.forEach((spec, specIndex) => {
    const assignment = assignments[specIndex];
    const random = seeded(specIndex + 11);
    const tier = PACKAGE_BY_ID.get(spec.packageId);
    const counts = spec.counts;
    const settled = shuffle(
      [
        ...Array<ApplicationStatus>(counts.qa_passed ?? 0).fill("qa_passed"),
        ...Array<ApplicationStatus>(counts.returned ?? 0).fill("returned"),
        ...Array<ApplicationStatus>(counts.failed ?? 0).fill("failed"),
      ],
      random,
    );
    const sequence: ApplicationStatus[] = [
      ...settled,
      ...Array<ApplicationStatus>(counts.submitted ?? 0).fill("submitted"),
      ...Array<ApplicationStatus>(counts.in_progress ?? 0).fill("in_progress"),
      ...Array<ApplicationStatus>(counts.queued ?? 0).fill("queued"),
    ];
    const worked = sequence.filter(
      (status) => status !== "queued" && status !== "in_progress",
    ).length;
    const start = new Date(assignment.assignedAt).getTime();
    const end =
      spec.status === "completed"
        ? new Date(assignment.dueAt).getTime()
        : MOCK_NOW.getTime() - 40 * 60_000;

    sequence.forEach((status, index) => {
      const progress = worked ? Math.min(index + 1, worked) / worked : 0;
      const settledAt = start + (end - start) * (0.08 + progress * 0.92);
      const updatedAt =
        status === "queued"
          ? start
          : status === "in_progress"
            ? MOCK_NOW.getTime() - (10 + index) * 60_000
            : settledAt + random() * 3_600_000;
      const issueList = status === "returned" || status === "failed" ? ISSUES[status] : null;
      records.push({
        id: `app-${assignment.id}-${index + 1}`,
        assignmentId: assignment.id,
        jobId: assignment.jobIds[index],
        bidderId: assignment.bidderId,
        packageId: assignment.packageId,
        taskId: assignment.taskId,
        status,
        updatedAt: new Date(Math.min(updatedAt, MOCK_NOW.getTime() - 60_000)).toISOString(),
        minutesSpent:
          status === "queued"
            ? undefined
            : Math.round((tier?.minutesPerLink ?? 10) * (0.75 + random() * 0.6) * 10) / 10,
        issue: issueList ? issueList[Math.floor(random() * issueList.length)] : undefined,
      });
    });
  });
  return records;
}

export const INITIAL_ASSIGNMENTS: Assignment[] = buildAssignments();
export const INITIAL_APPLICATIONS: ApplicationRecord[] = buildApplications(INITIAL_ASSIGNMENTS);

export const INITIAL_FEEDBACK: Feedback[] = [
  {
    id: "fb-1",
    bidderId: "bidder-maya",
    assignmentId: "asg-maya-previous",
    rating: 5,
    message: "Clean batch. Every screenshot was attached and the duplicate flags saved me time.",
    at: isoAgo(11),
    tags: ["Accurate", "Communicative"],
  },
  {
    id: "fb-2",
    bidderId: "bidder-daniel",
    assignmentId: "asg-daniel-current",
    rating: 4,
    message: "Short answers read well. Please double check the portfolio URL on Ashby forms.",
    at: isoAgo(3),
    tags: ["Quality writing", "Check links"],
  },
  {
    id: "fb-3",
    bidderId: "bidder-elena",
    assignmentId: "asg-elena-batch",
    rating: 5,
    message:
      "Excellent handling of the reference fields. Keep the same pace for the rest of the batch.",
    at: isoAgo(4),
    tags: ["Thorough", "On schedule"],
  },
  {
    id: "fb-4",
    bidderId: "bidder-samir",
    assignmentId: "asg-samir-batch",
    rating: 5,
    message: "Delivered a day early with a clear completion log. Happy to hire again.",
    at: isoAgo(22),
    tags: ["Early delivery"],
  },
  {
    id: "fb-5",
    bidderId: "bidder-jordan",
    assignmentId: "asg-jordan-current",
    rating: 4,
    message:
      "Good speed. One returned application had the wrong resume version, please recheck before each submit.",
    at: isoAgo(1),
    tags: ["Fast", "Resume version"],
  },
];
