"use client";

import { Button, Icon, icons, type ButtonSize } from "@openseat/design-system";
import { ROUTES } from "@/lib/routes";

export function PostJobButton({ size }: { size?: ButtonSize }) {
  return (
    <Button
      label="Post a job"
      variant="primary"
      size={size}
      href={ROUTES.companyJobNew}
      icon={<Icon icon={icons.plus} />}
    />
  );
}
