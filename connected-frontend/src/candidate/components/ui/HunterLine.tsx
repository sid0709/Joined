import { Glyph } from "@joined/design-system";

import type { BoardHunter } from "@/src/candidate/types/workspace";

import { Stars } from "@/src/candidate/components/ui/Stars";
import { Person } from "@/src/shared/kit/Person";

export function HunterLine({
  hunter,
  size = 32,
}: {
  hunter: BoardHunter;
  size?: 24 | 32 | 40 | 48;
}) {
  return (
    <Person
      name={hunter.company}
      size={size}
      detail={
        <span className="hx-row" style={{ gap: "var(--space-2)" }}>
          <span>{hunter.name}</span>
          <Stars value={hunter.rating} />
          {hunter.verified && (
            <span className="bx-verified" title="Payment verified">
              <Glyph name="check" size="0.9em" /> Verified
            </span>
          )}
        </span>
      }
    />
  );
}
