"use client";

import { useState } from "react";
import { Card, List, ListItem, Stack, Switch, Text } from "@openseat/design-system";

const PANEL_WIDTH = 560;

export function SettingsPanel() {
  const [email, setEmail] = useState(true);
  const [interviews, setInterviews] = useState(true);
  const [product, setProduct] = useState(false);

  return (
    <Stack gap={4} maxWidth={PANEL_WIDTH}>
      <Card padding={2}>
        <List hasDividers header={<Text type="label">Notifications</Text>}>
          <ListItem
            label="Application updates"
            description="When a company views or replies."
            endContent={<Switch label="Application updates" isLabelHidden value={email} onChange={setEmail} />}
          />
          <ListItem
            label="Interview reminders"
            description="The day before a scheduled round."
            endContent={<Switch label="Interview reminders" isLabelHidden value={interviews} onChange={setInterviews} />}
          />
          <ListItem
            label="Product notes"
            description="Occasional notes about Opened. At most one a week."
            endContent={<Switch label="Product notes" isLabelHidden value={product} onChange={setProduct} />}
          />
        </List>
      </Card>
      <Card padding={2}>
        <List hasDividers header={<Text type="label">Connected accounts</Text>}>
          <ListItem label="Calendar" description="Not connected. Used to detect and confirm interviews." />
          <ListItem label="Email" description="Not connected. Used only to notice interview invites." />
        </List>
      </Card>
      <Card padding={2}>
        <List hasDividers header={<Text type="label">Privacy</Text>}>
          <ListItem label="Export data" description="Download your profile, resumes, and applications." />
          <ListItem label="Delete account" description="Removes your hunter profile. Company memberships stay until an owner removes you." />
        </List>
      </Card>
    </Stack>
  );
}
