"use client";

import { Button, Icon, icons } from "@openseat/design-system";
import { ROUTES } from "@/lib/routes";

export function PostJobButton() {
  return <Button label="Post a job" variant="primary" href={ROUTES.companyJobNew} icon={<Icon icon={icons.plus} />} />;
}
