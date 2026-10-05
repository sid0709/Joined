import { Glyph } from "sid-ui";

import type { ChecklistItem, ProfileForm } from "@/src/client/components/profile/useProfileForm";

import { useHunter } from "@/src/client/context/HunterContext";
import { Meter } from "@/src/shared/kit/Meter";
import { Panel } from "@/src/shared/kit/Panel";
import { Person } from "@/src/shared/kit/Person";

interface ProfileSidebarProps {
  form: ProfileForm;
  checklist: ChecklistItem[];
  completeness: number;
}

/** Live preview of what bidders see, and a checklist that builds trust. */
export function ProfileSidebar({ form, checklist, completeness }: ProfileSidebarProps) {
  const { tasks, inquiries } = useHunter();
  const hired = inquiries.filter((item) => item.stage === "connected").length;
  const live = tasks.filter(
    (task) => task.status === "open" || task.status === "in_progress",
  ).length;

  return (
    <div className="hx-stack hx-sticky">
      <div className="hx-preview-card">
        <span className="hx-small hx-muted hx-strong">HOW BIDDERS SEE YOU</span>
        <Person
          name={form.company || form.fullName || "Your business"}
          detail={form.location || "Location not set"}
          size={48}
        />
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          {form.headline || "Add a headline so bidders know who you are."}
        </p>
        <div className="hx-chip-row">
          {form.industry && <span className="hx-chip">{form.industry}</span>}
          {form.organizationType && <span className="hx-chip">{form.organizationType}</span>}
        </div>
        <dl className="hx-kv">
          <dt>Live tasks</dt>
          <dd className="hx-num">{live}</dd>
          <dt>Bidders hired</dt>
          <dd className="hx-num">{hired}</dd>
          <dt>Interviews</dt>
          <dd>
            {form.availability.defaultDurationMin} min · {form.availability.timezone.split(" (")[0]}
          </dd>
        </dl>
      </div>

      <Panel title="Profile strength" subtitle={`${completeness}% complete`}>
        <Meter
          label="Profile completeness"
          total={100}
          segments={[
            {
              label: "Complete",
              value: completeness,
              tone: completeness === 100 ? "positive" : "accent",
            },
          ]}
          large
        />
        <div className="hx-stack hx-stack-sm">
          {checklist.map((item) => (
            <div key={item.label} className="hx-check-row" data-done={item.done}>
              <span className="hx-check-mark">
                {item.done ? <Glyph name="check" size="0.8em" /> : null}
              </span>
              {item.label}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
