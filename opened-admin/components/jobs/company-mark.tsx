"use client";

import { useState } from "react";

export function CompanyMark({ name, logo }: { name?: string; logo?: string }) {
  const [failed, setFailed] = useState(false);
  const label = name?.trim() || "Company";
  const initial = label.charAt(0).toUpperCase() || "?";

  if (!logo || failed) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-paper text-xs font-semibold text-muted">
        {initial}
      </span>
    );
  }

  return (
    // Remote company logos come from arbitrary job metadata hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt=""
      className="size-9 shrink-0 rounded-md bg-paper object-cover"
      onError={() => setFailed(true)}
    />
  );
}
