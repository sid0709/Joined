import type { MailThread } from "@/lib/account";

/** Hiring workspace — the company inbox. Sample data until the API lands. */

export const COMPANY_UNREAD_MESSAGES = 3;

export const COMPANY_THREADS: MailThread[] = [
  {
    id: "alex-rivera",
    title: "Alex Rivera",
    preview: "Today at 3:00 PM works for me.",
    messages: [
      {
        id: "ar1",
        from: "you",
        text: "Hi Alex — thanks for applying to Product Designer. Could you do a video round today at 3:00 PM?",
        time: "9:05",
      },
      {
        id: "ar2",
        from: "them",
        text: "Today at 3:00 PM works for me. Looking forward to it.",
        time: "9:31",
      },
    ],
  },
  {
    id: "riley-chen",
    title: "Riley Chen",
    preview: "Should I bring anything for the SQL exercise?",
    messages: [
      {
        id: "rc1",
        from: "you",
        text: "Round 2 is confirmed for tomorrow at 11:00 AM.",
        time: "Yesterday",
      },
      {
        id: "rc2",
        from: "them",
        text: "Thanks! Should I bring anything for the SQL exercise?",
        time: "Yesterday",
      },
    ],
  },
  {
    id: "dana-kim",
    title: "Dana Kim",
    preview: "Any of Thursday’s slots would suit me.",
    messages: [
      {
        id: "dk1",
        from: "you",
        text: "We’d like to set up a first round. Here are three slots this week.",
        time: "Mon",
      },
      { id: "dk2", from: "them", text: "Any of Thursday’s slots would suit me.", time: "Mon" },
    ],
  },
];
