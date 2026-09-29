import { totalUnread, type MailThread } from "./messages";
import { ROUTES } from "./routes";

/** The candidate inbox. Sample data until the messaging API lands. */
export const THREADS: MailThread[] = [
  {
    id: "northwind",
    title: "Northwind",
    subtitle: "Product Designer",
    kind: "company",
    stage: "Interviewing",
    unread: 1,
    details: [
      { label: "Role", value: "Product Designer" },
      { label: "Location", value: "Chicago, IL · Hybrid" },
      { label: "Next step", value: "Video round, Tue 10:00 AM" },
      { label: "With", value: "Priya Shah, Head of Design" },
    ],
    links: [
      { label: "View job", href: ROUTES.job("product-designer-northwind") },
      { label: "Interviews", href: ROUTES.interviews },
    ],
    messages: [
      {
        id: "n1",
        from: "them",
        text: "Hi — thanks for applying to Product Designer. Your portfolio stood out to the design team.",
        day: "Monday",
        time: "9:12 AM",
      },
      {
        id: "n2",
        from: "them",
        text: "Are you free Tuesday at 10:00 for a 45-minute video round with Priya, our Head of Design?",
        day: "Monday",
        time: "9:12 AM",
      },
      {
        id: "n3",
        from: "you",
        text: "Thank you! Tuesday at 10:00 works well for me.",
        day: "Monday",
        time: "9:40 AM",
        status: "read",
      },
      {
        id: "n4",
        from: "event",
        text: "Video round scheduled for Tuesday, 10:00 AM",
        day: "Monday",
        time: "9:41 AM",
      },
      {
        id: "n5",
        from: "them",
        text: "Great — the invite is on its way. Bring one project you’d walk us through end to end; we’ll leave time for your questions about the team.",
        day: "Today",
        time: "11:02 AM",
      },
    ],
  },
  {
    id: "harbor",
    title: "Harbor",
    subtitle: "Support Lead",
    kind: "company",
    stage: "Applied",
    unread: 1,
    details: [
      { label: "Role", value: "Support Lead" },
      { label: "Location", value: "Remote · US" },
      { label: "Next step", value: "Recruiter review" },
    ],
    links: [
      { label: "View job", href: ROUTES.job("support-lead-harbor") },
      { label: "Applications", href: ROUTES.applications },
    ],
    messages: [
      {
        id: "h1",
        from: "event",
        text: "You applied to Support Lead",
        day: "Sep 18",
        time: "4:02 PM",
      },
      {
        id: "h2",
        from: "them",
        text: "We saw your application for Support Lead. A recruiter will write if there’s a fit — usually within a week.",
        day: "Yesterday",
        time: "4:20 PM",
      },
    ],
  },
  {
    id: "lumen",
    title: "Lumen Health",
    subtitle: "Engineering Manager",
    kind: "company",
    stage: "Screening",
    unread: 0,
    details: [
      { label: "Role", value: "Engineering Manager" },
      { label: "Location", value: "Boston, MA · On-site" },
      { label: "With", value: "Grace Kim, Recruiter" },
    ],
    links: [
      { label: "View job", href: ROUTES.job("engineering-manager-lumen") },
      { label: "Applications", href: ROUTES.applications },
    ],
    messages: [
      {
        id: "l1",
        from: "them",
        text: "Hi, this is Grace from Lumen Health. Could you share your salary expectations before the screening call?",
        day: "Sep 20",
        time: "2:15 PM",
      },
      {
        id: "l2",
        from: "you",
        text: "Of course — I’m targeting the posted range, and I’m flexible on the mix of base and equity.",
        day: "Sep 20",
        time: "3:04 PM",
        status: "read",
      },
      {
        id: "l3",
        from: "them",
        text: "Perfect, that lines up. I’ll send times for a 30-minute call.",
        day: "Sep 20",
        time: "3:30 PM",
      },
    ],
  },
  {
    id: "opened",
    title: "Opened",
    subtitle: "Account and resume",
    kind: "system",
    unread: 0,
    details: [{ label: "About", value: "Notes about your account, resume, and privacy." }],
    links: [{ label: "Review profile", href: ROUTES.profile }],
    messages: [
      {
        id: "s1",
        from: "them",
        text: "Your default resume was parsed. Review the headline on your profile before you apply to direct jobs.",
        day: "Saturday",
        time: "8:00 AM",
      },
    ],
  },
];

export const UNREAD_MESSAGES = totalUnread(THREADS);

export const INITIAL_SAVED_JOB_IDS = ["support-lead-harbor"];
