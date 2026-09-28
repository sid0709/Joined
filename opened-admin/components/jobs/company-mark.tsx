"use client";

import { useEffect, useState } from "react";

export function CompanyMark({
  name,
  logo,
  size = "sm",
}: {
  name?: string;
  logo?: string;
  size?: "sm" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [logo]);
  const label = name?.trim() || "Company";
  const initial = label.charAt(0).toUpperCase() || "?";
  const box = size === "lg" ? "size-16 text-lg" : "size-9 text-xs";

  if (!logo || failed) {
    return (
      <span
        className={`flex ${box} shrink-0 items-center justify-center rounded-md bg-paper font-semibold text-muted`}
      >
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
      className={`${box} shrink-0 rounded-md bg-paper object-cover`}
      onError={() => setFailed(true)}
    />
  );
}
