import { totalUnread, type MailThread } from "@/lib/messages";
import { ROUTES } from "@/lib/routes";

/** Hiring workspace — the company inbox. Sample data until the API lands. */

export const COMPANY_THREADS: MailThread[] = [
  {
    id: "alex-rivera",
    title: "Alex Rivera",
    subtitle: "Product Designer",
    kind: "person",
    stage: "Interview",
    unread: 1,
    details: [
      { label: "Applied for", value: "Product Designer" },
      { label: "Location", value: "Chicago, IL" },
      { label: "Fit", value: "91% · Verified" },
      { label: "Next step", value: "Video round, today 3:00 PM" },
    ],
    links: [
      { label: "Open applicant", href: ROUTES.companyApplicants },
      { label: "Interviews", href: ROUTES.companyInterviews },
    ],
    messages: [
      {
        id: "ar1",
        from: "you",
        text: "Hi Alex — thanks for applying to Product Designer. Could you do a video round today at 3:00 PM?",
        day: "Today",
        time: "9:05 AM",
        status: "read",
      },
      {
        id: "ar2",
        from: "them",
        text: "Today at 3:00 PM works for me. Looking forward to it.",
        day: "Today",
        time: "9:31 AM",
      },
      {
        id: "ar3",
        from: "event",
        text: "Video round scheduled for today, 3:00 PM",
        day: "Today",
        time: "9:32 AM",
      },
    ],
  },
  {
    id: "riley-chen",
    title: "Riley Chen",
    subtitle: "Data Analyst",
    kind: "person",
    stage: "Interview",
    unread: 1,
    details: [
      { label: "Applied for", value: "Data Analyst" },
      { label: "Location", value: "Remote · US" },
      { label: "Next step", value: "Round 2, tomorrow 11:00 AM" },
    ],
    links: [
      { label: "Open applicant", href: ROUTES.companyApplicants },
      { label: "Interviews", href: ROUTES.companyInterviews },
    ],
    messages: [
      {
        id: "rc1",
        from: "you",
        text: "Round 2 is confirmed for tomorrow at 11:00 AM.",
        day: "Yesterday",
        time: "4:10 PM",
        status: "read",
      },
      {
        id: "rc2",
        from: "them",
        text: "Thanks! Should I bring anything for the SQL exercise?",
        day: "Yesterday",
        time: "5:22 PM",
      },
    ],
  },
  {
    id: "dana-kim",
    title: "Dana Kim",
    subtitle: "Product Designer",
    kind: "person",
    stage: "Screening",
    unread: 1,
    details: [
      { label: "Applied for", value: "Product Designer" },
      { label: "Location", value: "Evanston, IL" },
      { label: "Fit", value: "84% · Verified" },
    ],
    links: [{ label: "Open applicant", href: ROUTES.companyApplicants }],
    messages: [
      {
        id: "dk1",
        from: "you",
        text: "We’d like to set up a first round. Here are three slots this week.",
        day: "Monday",
        time: "10:00 AM",
        status: "delivered",
      },
      {
        id: "dk2",
        from: "them",
        text: "Any of Thursday’s slots would suit me.",
        day: "Monday",
        time: "1:45 PM",
      },
    ],
  },
];

export const COMPANY_UNREAD_MESSAGES = totalUnread(COMPANY_THREADS);
