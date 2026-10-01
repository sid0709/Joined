/** Hiring workspace — activity recorded by the company. */

export type ActivityItem = {
  id: string;
  title: string;
  description: string;
  when: string;
  tone: "accent" | "success" | "warning" | "neutral";
  createdAt: Date;
};
