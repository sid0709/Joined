"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  MetadataList,
  MetadataListItem,
  Selector,
  Stack,
  Text,
  TextInput,
  useToast,
  SectionCard,
} from "sid-ui";
import { ApiError, VERIFICATION, type PayoutMethodType, type Profile } from "@joined/scout";
import { formatDay } from "@/lib/dates";
import { scoutSend } from "@/lib/scout/client";

const PAYOUT_TYPES: { value: PayoutMethodType; label: string }[] = [
  { value: "bank", label: "Bank account" },
  { value: "paypal", label: "PayPal" },
];

/** Saves one setup form, then reloads the page data. Field errors come back from the API. */
function useSave() {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<ApiError | null>(null);
  const save = async (path: string, method: "POST" | "PUT", body: unknown, done: string) => {
    setError(null);
    try {
      await scoutSend(path, method, body);
      toast({ body: done });
      router.refresh();
      return true;
    } catch (err) {
      if (err instanceof ApiError) setError(err);
      else toast({ body: "Could not save. Try again.", type: "error" });
      return false;
    }
  };
  const status = (field: string) => {
    const message = error?.field(field);
    return message ? { type: "error" as const, message } : undefined;
  };
  return { save, status, error };
}

function Card({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SectionCard title={title} action={badge}>
      <Stack gap={4}>{children}</Stack>
    </SectionCard>
  );
}

export function VerificationCard({ profile }: { profile: Profile }) {
  const { save, status } = useSave();
  const [legalName, setLegalName] = useState(profile.legal_name ?? profile.name);
  const [country, setCountry] = useState(profile.country ?? "");
  const meta = VERIFICATION[profile.verification];
  const canRequest = profile.verification === "none" || profile.verification === "rejected";

  return (
    <Card title="Identity" badge={<Badge label={meta.label} variant={meta.badge} />}>
      {profile.verification === "verified" ? (
        <Text color="secondary" display="block">
          Verified as {profile.legal_name}. You are tier 2.
        </Text>
      ) : null}
      {profile.verification === "pending" ? (
        <Text color="secondary" display="block">
          Our team is checking {profile.legal_name}. This usually takes a day.
        </Text>
      ) : null}
      {canRequest ? (
        <>
          <Text type="supporting" color="secondary" display="block">
            Payouts need tier 2. Use the name on your government ID.
          </Text>
          <TextInput
            label="Legal name"
            value={legalName}
            onChange={setLegalName}
            status={status("legal_name")}
          />
          <TextInput
            label="Country"
            value={country}
            onChange={(value) => setCountry(value.toUpperCase())}
            placeholder="US"
            description="Two-letter code."
            status={status("country")}
          />
          <Button
            label="Request verification"
            variant="secondary"
            clickAction={async () => {
              await save(
                "/me/verification",
                "POST",
                { legal_name: legalName, country },
                "Verification requested.",
              );
            }}
          />
        </>
      ) : null}
    </Card>
  );
}

export function TaxCard({ profile }: { profile: Profile }) {
  const { save, status } = useSave();
  const [editing, setEditing] = useState(profile.tax_info === null);
  const [legalName, setLegalName] = useState(
    profile.tax_info?.legal_name ?? profile.legal_name ?? profile.name,
  );
  const [country, setCountry] = useState(profile.tax_info?.country ?? profile.country ?? "");
  const [last4, setLast4] = useState("");
  const info = profile.tax_info;

  return (
    <Card
      title="Tax details"
      badge={
        info ? (
          <Badge label="Added" variant="success" />
        ) : (
          <Badge label="Needed" variant="warning" />
        )
      }
    >
      {info && !editing ? (
        <>
          <MetadataList columns="single">
            <MetadataListItem label="Legal name">{info.legal_name}</MetadataListItem>
            <MetadataListItem label="Country">{info.country}</MetadataListItem>
            <MetadataListItem label="Tax ID">•••• {info.tax_id_last4}</MetadataListItem>
            <MetadataListItem label="Added">{formatDay(info.completed_at)}</MetadataListItem>
          </MetadataList>
          <Button label="Update" variant="ghost" size="sm" clickAction={() => setEditing(true)} />
        </>
      ) : (
        <>
          <TextInput
            label="Legal name"
            value={legalName}
            onChange={setLegalName}
            status={status("legal_name")}
          />
          <TextInput
            label="Country"
            value={country}
            onChange={(value) => setCountry(value.toUpperCase())}
            placeholder="US"
            status={status("country")}
          />
          <TextInput
            label="Tax ID, last 4"
            value={last4}
            onChange={setLast4}
            description="We only keep the last four characters."
            status={status("tax_id_last4")}
          />
          <Button
            label="Save tax details"
            variant="secondary"
            clickAction={async () => {
              const ok = await save(
                "/me/tax",
                "PUT",
                { legal_name: legalName, country, tax_id_last4: last4 },
                "Tax details saved.",
              );
              if (ok) setEditing(false);
            }}
          />
        </>
      )}
    </Card>
  );
}

export function PayoutMethodCard({ profile }: { profile: Profile }) {
  const { save, status } = useSave();
  const method = profile.payout_method;
  const [editing, setEditing] = useState(method === null);
  const [type, setType] = useState<PayoutMethodType>(method?.type ?? "bank");
  const [label, setLabel] = useState(method?.label ?? "");
  const [last4, setLast4] = useState("");

  return (
    <Card
      title="Payout method"
      badge={
        method ? (
          <Badge label="Added" variant="success" />
        ) : (
          <Badge label="Needed" variant="warning" />
        )
      }
    >
      {method && !editing ? (
        <>
          <MetadataList columns="single">
            <MetadataListItem label="Type">
              {PAYOUT_TYPES.find((item) => item.value === method.type)?.label}
            </MetadataListItem>
            <MetadataListItem label="Name">{method.label}</MetadataListItem>
            <MetadataListItem label="Account">•••• {method.last4}</MetadataListItem>
          </MetadataList>
          <Button label="Change" variant="ghost" size="sm" clickAction={() => setEditing(true)} />
        </>
      ) : (
        <>
          <Selector
            label="Type"
            options={PAYOUT_TYPES}
            value={type}
            onChange={(value) => setType(value as PayoutMethodType)}
          />
          <TextInput
            label="Name"
            value={label}
            onChange={setLabel}
            placeholder={type === "bank" ? "Chase checking" : "PayPal"}
            status={status("label")}
          />
          <TextInput
            label="Account, last 4"
            value={last4}
            onChange={setLast4}
            description="Only the last four characters; payments staff confirm the rest with you."
            status={status("last4")}
          />
          <Button
            label="Save payout method"
            variant="secondary"
            clickAction={async () => {
              const ok = await save(
                "/me/payout-method",
                "PUT",
                { type, label, last4 },
                "Payout method saved.",
              );
              if (ok) setEditing(false);
            }}
          />
        </>
      )}
    </Card>
  );
}
