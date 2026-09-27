export type MailMessage = {
  id: string;
  from: "them" | "you";
  text: string;
  time: string;
};

export type MailThread = {
  id: string;
  title: string;
  preview: string;
  messages: MailMessage[];
};

export const UNREAD_MESSAGES = 2;

export const THREADS: MailThread[] = [
  {
    id: "northwind",
    title: "Northwind",
    preview: "Tuesday at 10:00 still works.",
    messages: [
      {
        id: "n1",
        from: "them",
        text: "Thanks for applying. Are you free Tuesday at 10:00 for a video round?",
        time: "Mon 9:12",
      },
      { id: "n2", from: "you", text: "Yes, Tuesday at 10:00 works.", time: "Mon 9:40" },
      {
        id: "n3",
        from: "them",
        text: "Tuesday at 10:00 still works. The invite is on its way.",
        time: "Mon 11:02",
      },
    ],
  },
  {
    id: "harbor",
    title: "Harbor",
    preview: "We saw your application.",
    messages: [
      {
        id: "h1",
        from: "them",
        text: "We saw your application for Frontend Engineer. A recruiter will write if there is a fit.",
        time: "Sun 16:20",
      },
    ],
  },
  {
    id: "system",
    title: "Opened",
    preview: "Your default resume was parsed.",
    messages: [
      {
        id: "s1",
        from: "them",
        text: "Your default resume was parsed. Review the headline on your profile before you apply to direct jobs.",
        time: "Sat 8:00",
      },
    ],
  },
];

export const INITIAL_SAVED_JOB_IDS = ["support-lead-harbor"];
