import { Button, Timeline, type TimelineItem } from "sid-ui";
import { formatWhen, type ResumeDraft } from "@/lib/workspace/model";

/** Every Generate, newest first. The one in the preview is marked current. */
export function GenerationHistory({
  history,
  selectedId,
  onView,
}: {
  history: ResumeDraft[];
  selectedId: string | null;
  onView: (id: string) => void;
}) {
  const items: TimelineItem[] = history.map((resume) => ({
    id: resume.id,
    title: resume.company ? `${resume.role} · ${resume.company}` : resume.role,
    time: formatWhen(resume.createdAt),
    description: resume.focus.length
      ? `Focus: ${resume.focus.join(", ")}`
      : "Built from your profile alone",
    status: resume.id === selectedId ? "current" : "done",
    tone: resume.id === selectedId ? "accent" : "neutral",
    meta:
      resume.id === selectedId ? null : (
        <Button label="Preview" variant="ghost" size="sm" onClick={() => onView(resume.id)} />
      ),
  }));
  return <Timeline label="Generation history" items={items} />;
}
