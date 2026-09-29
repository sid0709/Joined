"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  HStack,
  NumberInput,
  RadioList,
  RadioListItem,
  SegmentedControl,
  SegmentedControlItem,
  Selector,
  Stack,
  Switch,
  Text,
  TextInput,
  useToast,
} from "@openseat/design-system";
import { SaveFooter } from "@/components/save-footer";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { POLICY_META, type AssistedPolicy } from "@/lib/company";
import { fetchSettings, fetchTeam, saveSettings, transferOwnership } from "@/lib/company/api";
import type { AuthSession } from "@/lib/auth/types";
import { RemoveAccount } from "@/components/settings/remove-account";

const POLICIES = Object.keys(POLICY_META) as AssistedPolicy[];
const DEFAULT_DAILY_CAP = 5;
const DIGESTS = [
  { value: "instant", label: "Instant" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];
const SPEND_ALERT_PERCENT = 80;
const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Company-wide defaults: domains, assisted policy, alerts, and ownership. */
export function CompanySettings({ session }: { session: AuthSession }) {
  const toast = useToast();
  const [domains, setDomains] = useState<{ name: string; verified: boolean }[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [policy, setPolicy] = useState<AssistedPolicy>("accept");
  const [dailyCap, setDailyCap] = useState(DEFAULT_DAILY_CAP);
  const [faceCheck, setFaceCheck] = useState(true);
  const [autoReply, setAutoReply] = useState(true);
  const [digest, setDigest] = useState("daily");
  const [spendAlert, setSpendAlert] = useState(true);
  const [transferTo, setTransferTo] = useState("");
  const [transferOptions, setTransferOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchSettings(), fetchTeam()])
      .then(([settings, team]) => {
        if (!active) return;
        setDomains(settings.domains);
        setPolicy(settings.policy);
        setDailyCap(settings.dailyCap);
        setFaceCheck(settings.faceCheck);
        setAutoReply(settings.autoReply);
        setDigest(settings.digest);
        setSpendAlert(settings.spendAlert);
        const options = team.members
          .filter((member) => !member.isYou && !member.isPending && member.role !== "owner")
          .map((member) => ({ value: member.id, label: member.name }));
        setTransferOptions(options);
        setTransferTo(options[0]?.value ?? "");
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    return () => {
      active = false;
    };
  }, [toast]);

  const persist = (message: string) => {
    saveSettings({ domains, policy, dailyCap, faceCheck, autoReply, digest, spendAlert })
      .then((saved) => {
        setDomains(saved.domains);
        toast({ body: message });
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
  };

  const domain = newDomain.trim().toLowerCase();
  const domainValid = DOMAIN_PATTERN.test(domain) && !domains.some((item) => item.name === domain);

  return (
    <Stack gap={6}>
      <SettingsGroup
        title="Domains"
        description="Teammates with these email domains can join, and your jobs show as verified."
      >
        {domains.map((item) => (
          <HStack key={item.name} hAlign="between" vAlign="center" gap={3}>
            <Text weight="medium">{item.name}</Text>
            {item.verified ? (
              <Badge label="Verified" variant="success" />
            ) : (
              <Badge label="Check DNS" variant="warning" />
            )}
          </HStack>
        ))}
        <SettingsRow
          label="Add a domain"
          description="We’ll give you a DNS record to prove you own it."
        >
          <HStack gap={2} vAlign="center">
            <TextInput
              label="Domain"
              isLabelHidden
              value={newDomain}
              onChange={setNewDomain}
              placeholder="careers.example.com"
            />
            <Button
              label="Add"
              variant="secondary"
              isDisabled={!domainValid}
              onClick={() => {
                const next = [...domains, { name: domain, verified: false }];
                setDomains(next);
                setNewDomain("");
                saveSettings({
                  domains: next,
                  policy,
                  dailyCap,
                  faceCheck,
                  autoReply,
                  digest,
                  spendAlert,
                })
                  .then((saved) => {
                    setDomains(saved.domains);
                    toast({ body: `Saved ${domain}.` });
                  })
                  .catch((error: Error) => toast({ body: error.message, type: "error" }));
              }}
            />
          </HStack>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="Hiring defaults"
        description="New jobs start with these. Each job can override them."
        footer={
          <SaveFooter
            hint="Existing jobs keep their own settings."
            message="Hiring defaults saved"
            action={
              <Button
                label="Save"
                variant="primary"
                size="sm"
                onClick={() => persist("Hiring defaults saved")}
              />
            }
          />
        }
      >
        <RadioList
          label="Assisted applications"
          value={policy}
          onChange={(value) => setPolicy(value as AssistedPolicy)}
        >
          {POLICIES.map((value) => (
            <RadioListItem
              key={value}
              value={value}
              label={POLICY_META[value].label}
              description={POLICY_META[value].description}
            />
          ))}
        </RadioList>
        <SettingsRow
          label="Daily cap"
          description="Assisted applications accepted per job per day."
        >
          <NumberInput
            label="Daily cap"
            isLabelHidden
            value={dailyCap}
            onChange={setDailyCap}
            min={1}
            isIntegerOnly
            isDisabled={policy !== "cap"}
          />
        </SettingsRow>
        <SettingsRow
          label="Face check at join"
          description="Confirm the person on video matches their verified ID."
          layout="inline"
        >
          <Switch
            label="Face check at join"
            isLabelHidden
            value={faceCheck}
            onChange={setFaceCheck}
          />
        </SettingsRow>
        <SettingsRow
          label="Always close the loop"
          description="Tell candidates when a job closes or they’re not moving on."
          layout="inline"
        >
          <Switch
            label="Always close the loop"
            isLabelHidden
            value={autoReply}
            onChange={setAutoReply}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="Team notifications"
        footer={
          <SaveFooter
            hint="Goes to owners and admins."
            message="Team notifications saved"
            action={
              <Button
                label="Save"
                variant="primary"
                size="sm"
                onClick={() => persist("Team notifications saved")}
              />
            }
          />
        }
      >
        <SettingsRow label="New applicant digest">
          <SegmentedControl label="New applicant digest" value={digest} onChange={setDigest}>
            {DIGESTS.map((option) => (
              <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
            ))}
          </SegmentedControl>
        </SettingsRow>
        <SettingsRow
          label="Spend alert"
          description={`Email the owner at ${SPEND_ALERT_PERCENT}% of the monthly cap.`}
          layout="inline"
        >
          <Switch label="Spend alert" isLabelHidden value={spendAlert} onChange={setSpendAlert} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        title="Ownership"
        description="Only the owner can manage billing and close the company account."
      >
        <SettingsRow label="Transfer ownership" description="You’ll become an admin.">
          <HStack gap={2} vAlign="center">
            <Selector
              label="New owner"
              isLabelHidden
              options={transferOptions}
              value={transferTo}
              onChange={setTransferTo}
            />
            <Button
              label="Transfer"
              variant="secondary"
              isDisabled={!transferTo || session.company?.isCreator !== true}
              onClick={() =>
                transferOwnership(transferTo)
                  .then(() => toast({ body: "Ownership transferred. You are now an admin." }))
                  .catch((error: Error) => toast({ body: error.message, type: "error" }))
              }
            />
          </HStack>
        </SettingsRow>
        <SettingsRow
          label="Close company account"
          description="Closes every job and removes the team. Candidates are told."
          layout="inline"
        >
          <Button
            label="Close account"
            variant="destructive"
            size="sm"
            onClick={() =>
              toast({
                body: "Delete your account below if you created this company. That removes its jobs and balance.",
                type: "error",
              })
            }
          />
        </SettingsRow>
      </SettingsGroup>

      <RemoveAccount
        signedIn
        companyName={session.company?.name}
        isCreator={session.company?.isCreator === true}
      />
    </Stack>
  );
}
