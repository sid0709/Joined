import type {
  BidderInterview,
  ChatMessage,
  Engagement,
  Invitation,
} from "@/src/candidate/types/workspace";

import { isoAgo, isoAhead, ymdFromNow } from "@/src/shared/mock/clock";

let counter = 0;
function msg(sender: ChatMessage["sender"], body: string, days: number, hours = 0): ChatMessage {
  counter += 1;
  return { id: `bm-${counter}`, sender, body, at: isoAgo(days, hours) };
}

export const INITIAL_ENGAGEMENTS: Engagement[] = [
  {
    id: "eng-startup",
    taskId: "task-startup-desk",
    status: "connected",
    stage: "connected",
    pitch:
      "Two years on Lever and Ashby, mostly startup product roles. I verify every portfolio link and keep a log of answers I've written for each client.",
    proposedRates: [{ packageId: "pkg-startup", rate: 1.4 }],
    weeklyCapacity: 60,
    createdAt: isoAgo(26),
    unread: 1,
    replies: 3,
    messages: [
      msg(
        "bidder",
        "Hi Avery, I saw the Lever & Ashby desk. I've done about 700 startup applications and always verify portfolio links before submitting. I can handle 10–12 links a day at $1.40.",
        26,
      ),
      msg(
        "hunter",
        "Thanks Alex, your QA history looks solid. Can you do a short call tomorrow so we can agree pace and how you write the short answers?",
        26,
        -3,
      ),
      msg("bidder", "Tomorrow at 2pm ET works for me.", 25, 20),
      msg(
        "system",
        "Avery Morgan accepted your inquiry. You are now connected to Lever & Ashby startup desk.",
        24,
      ),
      msg(
        "hunter",
        "Welcome aboard. First batch of 18 links is in your Work tab. Please send the answers to the motivation questions as a comment on the first three so I can calibrate the tone.",
        24,
        -1,
      ),
      msg("bidder", "Got it. I'll post a note on the first three after I submit them.", 24, -2),
      msg(
        "hunter",
        "Two Ashby links from the last batch bounced on the LinkedIn field. I've left details in Reviews. Quick fix and they're good.",
        1,
        2,
      ),
    ],
  },
  {
    id: "eng-ops",
    taskId: "task-ops-volume",
    status: "connected",
    stage: "connected",
    pitch: "High-volume Greenhouse and SmartRecruiters experience, averaging 6 minutes per link.",
    proposedRates: [
      { packageId: "pkg-greenhouse", rate: 0.75 },
      { packageId: "pkg-smartrecruiters", rate: 1.05 },
    ],
    weeklyCapacity: 120,
    createdAt: isoAgo(40),
    unread: 0,
    replies: 4,
    messages: [
      msg(
        "bidder",
        "Hello Grace, I'd like to join the operations desk. I can do 25 links a day.",
        40,
      ),
      msg(
        "hunter",
        "Great, we're short on Greenhouse capacity. Standard rate is $0.75 per link, $1.05 on SmartRecruiters.",
        40,
        -4,
      ),
      msg("bidder", "That works. Starting Monday.", 39, 18),
      msg("system", "Grace Liu accepted your inquiry. You are now connected.", 39, 16),
      msg("hunter", "Batch one is live. Please post a short summary at end of day.", 39, 14),
      msg(
        "bidder",
        "Day summary: 24 submitted, 0 blocked. Two duplicate companies skipped and noted.",
        2,
        6,
      ),
      msg("hunter", "Perfect, thank you. Friday payout is on its way.", 2, 4),
    ],
  },
  {
    id: "eng-fin",
    taskId: "task-finance-desk",
    status: "connected",
    stage: "connected",
    pitch:
      "Background in fintech operations, so finance job descriptions are familiar. Comfortable with Workday accounts and multi-step profiles.",
    proposedRates: [
      { packageId: "pkg-workday", rate: 1.45 },
      { packageId: "pkg-smartrecruiters", rate: 1.15 },
    ],
    weeklyCapacity: 50,
    createdAt: isoAgo(18),
    unread: 2,
    replies: 3,
    messages: [
      msg(
        "bidder",
        "Hi Marcus, I worked at a fintech for two years and know Workday well. Is the desk still open?",
        18,
      ),
      msg("hunter", "It is. Can you start this week? Workday rate is $1.45.", 18, -2),
      msg("bidder", "Yes. I can commit to weekday mornings, around 8 links a day.", 17, 20),
      msg("system", "Marcus Bell accepted your inquiry. You are now connected.", 17, 12),
      msg(
        "hunter",
        "First Workday drop is assigned. Use the shared vault for employer accounts please.",
        17,
        10,
      ),
      msg(
        "hunter",
        "Heads up: two of your submissions were returned for resume parsing errors. Details in Reviews.",
        0,
        6,
      ),
      msg(
        "hunter",
        "Also the SmartRecruiters drop lands tomorrow morning. Let me know if you want it.",
        0,
        5,
      ),
    ],
  },
  {
    id: "eng-workday",
    taskId: "task-workday-batch",
    status: "negotiating",
    stage: "interview",
    pitch:
      "I have completed more than 400 Workday submissions with a 95% first-pass QA rate and I hold the Joined Workday certification.",
    proposedRates: [{ packageId: "pkg-workday", rate: 1.5 }],
    weeklyCapacity: 45,
    createdAt: isoAgo(2),
    unread: 1,
    replies: 1,
    messages: [
      msg(
        "bidder",
        "Hi Priya, I'd like to take the senior technical batch. I hold the Workday certification and can deliver all 24 in five days.",
        2,
      ),
      msg(
        "hunter",
        "Thanks Alex. Your profile looks strong. Let's do a 30 minute call tomorrow to walk through account handling and the resume parsing fixes.",
        1,
        20,
      ),
      msg(
        "system",
        "Priya Nair scheduled an interview for tomorrow at 3:00 PM. Add it to your calendar in Interviews.",
        1,
        19,
      ),
    ],
  },
  {
    id: "eng-gh",
    taskId: "task-gh-desk",
    status: "negotiating",
    stage: "screening",
    pitch:
      "Greenhouse is my strongest ATS. I'd like to add a second desk and can commit 12 links a day.",
    proposedRates: [{ packageId: "pkg-greenhouse", rate: 0.85 }],
    weeklyCapacity: 60,
    createdAt: isoAgo(0, 5),
    unread: 1,
    replies: 1,
    messages: [
      msg(
        "bidder",
        "Hi Avery, Greenhouse is my strongest ATS. I'd like to take a slot on the weekly desk and can commit 12 links a day at $0.85.",
        0,
        5,
      ),
      msg(
        "hunter",
        "Hi Alex, thanks for reaching out. Can you tell me how you handle the free-text questions and whether you keep your own answer bank?",
        0,
        3,
      ),
    ],
  },
  {
    id: "eng-data",
    taskId: "task-data-desk",
    status: "contacted",
    stage: "inquiry",
    pitch: "Comfortable with analytics job descriptions and available four weekdays each week.",
    proposedRates: [
      { packageId: "pkg-greenhouse", rate: 0.9 },
      { packageId: "pkg-startup", rate: 1.3 },
    ],
    weeklyCapacity: 40,
    createdAt: isoAgo(0, 2),
    unread: 0,
    replies: 0,
    messages: [
      msg(
        "bidder",
        "Hello Tom, I read the data desk brief and it's a good fit. I can work Monday to Thursday, around 8 links a day across Greenhouse and Ashby.",
        0,
        2,
      ),
    ],
  },
  {
    id: "eng-design",
    taskId: "task-design-desk",
    status: "declined",
    stage: "declined",
    pitch: "Some design portfolio review experience from a previous agency role.",
    proposedRates: [{ packageId: "pkg-startup", rate: 1.5 }],
    weeklyCapacity: 30,
    createdAt: isoAgo(7),
    unread: 0,
    replies: 2,
    messages: [
      msg("bidder", "Hi Omar, I'm interested in the design desk.", 7),
      msg(
        "hunter",
        "Thanks Alex. I'm looking for someone with a design background for portfolio matching, so I'll pass for now. Good luck.",
        6,
        20,
      ),
      msg("system", "Omar Haddad declined this inquiry.", 6, 19),
    ],
  },
];

export const INITIAL_INVITATIONS: Invitation[] = [
  {
    id: "inv-health",
    taskId: "task-health-launch",
    sentAt: isoAgo(0, 6),
    expiresAt: isoAhead(3),
    offeredRate: 2.15,
    message:
      "Your QA record on long forms stood out. I'd like you for the healthcare launch batch. You'd need the iCIMS assessment before I can assign links.",
    status: "pending",
  },
  {
    id: "inv-icims",
    taskId: "task-icims-specialist",
    sentAt: isoAgo(1),
    expiresAt: isoAhead(5),
    offeredRate: 2.05,
    message:
      "Priya here. Maya recommended you for the iCIMS desk. Rate is $2.05 a link, weekly payout, two slots open.",
    status: "pending",
  },
  {
    id: "inv-retail",
    taskId: "task-retail-closed",
    sentAt: isoAgo(9),
    expiresAt: isoAgo(2),
    offeredRate: 1.4,
    message: "We have a retail leadership batch on Workday. Interested?",
    status: "declined",
  },
];

export const INITIAL_INTERVIEWS: BidderInterview[] = [
  {
    id: "biv-workday",
    engagementId: "eng-workday",
    date: ymdFromNow(1),
    start: "15:00",
    durationMin: 30,
    mode: "video",
    status: "scheduled",
    link: "https://meet.northstar.example.com/interviews/alex-morgan",
    agenda: [
      "How you manage employer accounts",
      "Fixing resume parsing errors",
      "Delivery plan for 24 links in five days",
    ],
  },
  {
    id: "biv-gh",
    engagementId: "eng-gh",
    date: ymdFromNow(3),
    start: "11:30",
    durationMin: 20,
    mode: "phone",
    status: "scheduled",
    agenda: ["Answer bank walkthrough", "Weekly capacity and pace"],
  },
  {
    id: "biv-startup",
    engagementId: "eng-startup",
    date: ymdFromNow(-25),
    start: "14:00",
    durationMin: 30,
    mode: "video",
    status: "completed",
    link: "https://meet.morgancareer.example.com/interviews/alex",
    agenda: ["Pace and quality", "Short-answer tone"],
    outcome: "Advanced to a paid first batch",
  },
  {
    id: "biv-fin",
    engagementId: "eng-fin",
    date: ymdFromNow(-17),
    start: "10:00",
    durationMin: 30,
    mode: "video",
    status: "completed",
    link: "https://meet.vertexsearch.example.com/interviews/alex",
    agenda: ["Workday experience", "Weekday availability"],
    outcome: "Connected the same day",
  },
];

export const INITIAL_SAVED_TASKS = ["task-cs-batch", "task-health-launch", "task-saas-sales"];
