"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, Stack, Switch, Text, TextInput, useToast } from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { DEMO_EMAIL, DEMO_PASSWORD, LEVELS } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import { useScout } from "@/lib/scout-store";

export function AccountWorkspace() {
  const toast = useToast();
  const router = useRouter();
  const scout = useScout();
  const user = scout.user;
  const [name, setName] = useState(user?.name ?? "");
  if (!user) return null;

  const save = () => {
    const result = scout.updateAccount({ name });
    if (!result.ok) {
      toast({ body: result.error, type: "error" });
      return;
    }
    toast({ body: "Account saved" });
  };

  return (
    <Stack gap={6}>
      <PageHeader
        title="Account"
        description="This browser is the database. Nothing is sent to a server."
      />
      <Banner
        status="info"
        title="Demo login"
        description={`${DEMO_EMAIL} / ${DEMO_PASSWORD} loads a Trusted scout with live jobs and rewards.`}
      />
      <SectionCard title="Profile">
        <Stack gap={4}>
          <TextInput label="Name" value={name} onChange={setName} />
          <TextInput label="Email" value={user.email} isDisabled />
          <Text type="supporting" color="secondary" display="block">
            {LEVELS[user.level].label} · verification tier {user.verificationTier} · phone{" "}
            {user.phoneVerified ? user.phone : "unverified"}
          </Text>
          <Button label="Save" variant="primary" size="sm" clickAction={save} />
        </Stack>
      </SectionCard>
      <SectionCard title="Notifications">
        <Stack gap={4}>
          <Switch
            label="Submission decisions"
            value={user.notifyDecisions}
            onChange={(notifyDecisions) => {
              scout.updateAccount({ notifyDecisions });
            }}
          />
          <Switch
            label="Reward ledger"
            value={user.notifyRewards}
            onChange={(notifyRewards) => {
              scout.updateAccount({ notifyRewards });
            }}
          />
        </Stack>
      </SectionCard>
      <SectionCard
        title="Demo data"
        description="Reset restores Maya's Trusted scout, including jobs, holds, and the paid transfer."
      >
        <Button
          label="Reset demo data"
          variant="secondary"
          clickAction={() => {
            scout.resetDemo();
            router.replace(ROUTES.signIn);
          }}
        />
      </SectionCard>
    </Stack>
  );
}
