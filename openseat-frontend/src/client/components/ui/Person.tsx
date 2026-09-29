import type { ReactNode } from "react";

import { Avatar } from "@/src/shared/marketplace-ui";

type AvatarPx = 24 | 32 | 40 | 48;

interface PersonProps {
  name: string;
  detail?: ReactNode;
  size?: AvatarPx;
}

export function Person({ name, detail, size = 32 }: PersonProps) {
  return (
    <div className="hx-person">
      <Avatar name={name} size={size} />
      <div className="hx-person-text">
        <span className="hx-strong hx-truncate">{name}</span>
        {detail && <span className="hx-small hx-muted hx-truncate">{detail}</span>}
      </div>
    </div>
  );
}

export function AvatarStack({ names, size = 24 }: { names: string[]; size?: AvatarPx }) {
  return (
    <div className="hx-avatar-stack">
      {names.map((name) => (
        <Avatar key={name} name={name} size={size} />
      ))}
    </div>
  );
}
