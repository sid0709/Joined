"use client";

import { Avatar, AvatarGroup, AvatarGroupOverflow, AvatarStatusDot } from "@/components/ui";

/** Client-side so Avatar can read the status dot's label on the first render. */
export function AvatarSamples() {
  return (
    <>
      <Avatar name="Jordan Miles" size="xsm" />
      <Avatar name="Alex Rivera" size="sm" />
      <Avatar name="Dana Kim" size={32} />
      <Avatar name="Riley Stone" size={32} status={<AvatarStatusDot variant="success" label="Online" />} />
      <AvatarGroup size="sm">
        <Avatar name="Jordan Miles" />
        <Avatar name="Alex Rivera" />
        <Avatar name="Dana Kim" />
        <AvatarGroupOverflow count={3} />
      </AvatarGroup>
    </>
  );
}
