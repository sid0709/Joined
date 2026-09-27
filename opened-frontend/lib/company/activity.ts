/** Hiring workspace — activity. Sample data until the API lands. */

export type ActivityItem = {
  id: string;
  title: string;
  description: string;
  when: string;
  tone: "accent" | "success" | "warning" | "neutral";
};

export const ACTIVITY: ActivityItem[] = [
  {
    id: "ev-1",
    title: "Priya Nair applied",
    description: "Product Designer · 88% fit",
    when: "12 min ago",
    tone: "accent",
  },
  {
    id: "ev-2",
    title: "Offer sent to Jamie Ortiz",
    description: "Product Designer · by Priya Shah",
    when: "2 hours ago",
    tone: "success",
  },
  {
    id: "ev-3",
    title: "Riley Chen confirmed round 2",
    description: "Data Analyst · tomorrow 11:00 AM",
    when: "Yesterday",
    tone: "accent",
  },
  {
    id: "ev-4",
    title: "Support Lead paused",
    description: "by Marcus Lee",
    when: "2 days ago",
    tone: "warning",
  },
  {
    id: "ev-5",
    title: "Senior UX Researcher published",
    description: "Remote · Direct only",
    when: "2 days ago",
    tone: "neutral",
  },
];
