"use client";

import { useState } from "react";
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
import { POLICY_META, TEAM, WORKSPACE, type AssistedPolicy } from "@/lib/company";
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
const TRANSFER_OPTIONS = TEAM.filter((member) => !member.isYou && !member.isPending).map(
  (member) => ({
    value: member.id,
    label: member.name,
  }),
);

/** Company-wide defaults: domains, assisted policy, alerts, and ownership. */
export function CompanySettings({ session }: { session: AuthSession }) {
  const toast = useToast();
  const [domains, setDomains] = useState([{ name: WORKSPACE.website, verified: true }]);
  const [newDomain, setNewDomain] = useState("");
  const [policy, setPolicy] = useState<AssistedPolicy>("accept");
  const [dailyCap, setDailyCap] = useState(DEFAULT_DAILY_CAP);
  const [faceCheck, setFaceCheck] = useState(true);
  const [autoReply, setAutoReply] = useState(true);
  const [digest, setDigest] = useState("daily");
  const [spendAlert, setSpendAlert] = useState(true);
  const [transferTo, setTransferTo] = useState(TRANSFER_OPTIONS[0]?.value ?? "");

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
                setDomains((current) => [...current, { name: domain, verified: false }]);
                setNewDomain("");
                toast({ body: `Added ${domain}. Add the DNS record to verify it.` });
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
        footer={<SaveFooter hint="Goes to owners and admins." message="Team notifications saved" />}
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
              options={TRANSFER_OPTIONS}
              value={transferTo}
              onChange={setTransferTo}
            />
            <Button
              label="Transfer"
              variant="secondary"
              onClick={() => toast({ body: "We emailed a confirmation link to the new owner." })}
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
              toast({ body: "Contact support to close a verified company.", type: "error" })
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
