import { Heading, Stack, Switch } from "sid-ui";

import { COPY } from "./copy";

export function NotificationSettings({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <Stack gap={2}>
      <Heading level={4}>{COPY.DESKTOP_NOTIFICATIONS}</Heading>
      <Switch
        label={COPY.DESKTOP_NOTIFICATIONS}
        description={COPY.DESKTOP_NOTIFICATIONS_DESCRIPTION}
        isLabelHidden
        value={enabled}
        onChange={onChange}
      />
    </Stack>
  );
}
