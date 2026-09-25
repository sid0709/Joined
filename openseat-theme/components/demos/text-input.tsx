"use client";

import { useState } from "react";
import {
  Button,
  Card,
  FormLayout,
  HStack,
  Heading,
  Icon,
  InputGroup,
  InputGroupText,
  Stack,
  Text,
  TextInput,
  icons,
  type InputStatus,
  type TextInputSize,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const SIZES: TextInputSize[] = ["sm", "md", "lg"];
const FIELD_WIDTH = 320;
const CHECK_MS = 700;
const TAKEN = ["jordan", "alex", "admin", "openseat"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function passwordStatus(value: string): InputStatus | undefined {
  if (!value) return undefined;
  if (value.length < MIN_PASSWORD) return { type: "error", message: `At least ${MIN_PASSWORD} characters.` };
  if (!/\d/.test(value)) return { type: "warning", message: "Stronger with a number." };
  return { type: "success", message: "Strong password." };
}

export default function TextInputDemo() {
  const [sizes, setSizes] = useState<Record<TextInputSize, string>>({ sm: "", md: "", lg: "" });
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("jordan@");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState<InputStatus | undefined>();
  const [domain, setDomain] = useState("northwind");
  const [price, setPrice] = useState("2400");
  const [entered, setEntered] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  return (
    <Examples>
      <Preview align="start" label="Sizes" description="sm 28px for dense rows, md 32px default, lg 36px for heroes and sign-in.">
        <Stack gap={3} width={FIELD_WIDTH}>
          {SIZES.map((size) => (
            <TextInput key={size} size={size} label={`Size ${size}`} placeholder="Room title" value={sizes[size]} onChange={(v) => setSizes((c) => ({ ...c, [size]: v }))} />
          ))}
        </Stack>
      </Preview>

      <Preview align="start" label="Types" description="text, email, and password — password gets a reveal toggle.">
        <Stack gap={3} width={FIELD_WIDTH}>
          <TextInput label="Email" type="email" value={email} onChange={setEmail} status={email && !EMAIL.test(email) ? { type: "error", message: "Enter a full email address." } : undefined} />
          <TextInput label="Password" type="password" value={password} onChange={setPassword} status={passwordStatus(password)} description="Try short, letters only, then add a number." />
        </Stack>
      </Preview>

      <Preview align="start" label="Label and help" description="Description under the label, optional or required markers, and a tooltip for the details.">
        <Stack gap={3} width={FIELD_WIDTH}>
          <TextInput label="Room title" description="Bidders see this first." value="" onChange={() => undefined} isRequired placeholder="Brand refresh" />
          <TextInput label="Internal code" value="" onChange={() => undefined} isOptional labelTooltip="Only your team sees this. Use it to match invoices." />
          <TextInput label="Search rooms" isLabelHidden value={search} onChange={setSearch} placeholder="Search rooms" startIcon={<Icon icon={icons.search} />} hasClear />
        </Stack>
      </Preview>

      <Preview align="start" label="Status" description="error, warning, and success — attached under the field, detached below it, or in a tooltip.">
        <Stack gap={3} width={FIELD_WIDTH}>
          <TextInput label="Budget" value="0" onChange={() => undefined} status={{ type: "error", message: "Enter an amount above $0." }} />
          <TextInput label="Deadline" value="Tomorrow" onChange={() => undefined} status={{ type: "warning", message: "Short deadlines get fewer bids." }} statusVariant="detached" />
          <TextInput label="Invite code" value="SEAT-4821" onChange={() => undefined} status={{ type: "success", message: "Code accepted." }} statusVariant="tooltip" />
        </Stack>
      </Preview>

      <Preview align="start" label="Async check" description="changeAction shows a spinner while it runs — here, a username availability check.">
        <Stack gap={2} width={FIELD_WIDTH}>
          <TextInput
            label="Username"
            value={handle}
            description={`Taken: ${TAKEN.join(", ")}`}
            startIcon={<Icon icon={icons.user} />}
            status={handleStatus}
            changeAction={async (v) => {
              setHandle(v);
              setHandleStatus(undefined);
              if (!v) return;
              await wait(CHECK_MS);
              setHandleStatus(TAKEN.includes(v.toLowerCase()) ? { type: "error", message: `@${v} is taken.` } : { type: "success", message: `@${v} is available.` });
            }}
          />
        </Stack>
      </Preview>

      <Preview align="start" label="Read-only and disabled" description="Read-only stays focusable and copyable; disabled can explain itself.">
        <Stack gap={3} width={FIELD_WIDTH}>
          <TextInput label="Room ID" value="room_1043" onChange={() => undefined} isReadOnly />
          <TextInput label="Owner" value="Jordan Miles" onChange={() => undefined} isDisabled disabledMessage="Only admins can transfer a room." />
        </Stack>
      </Preview>

      <Preview align="start" label="Input groups" description="InputGroup joins text and fields — prefixes, suffixes, and units.">
        <Stack gap={3} width={FIELD_WIDTH}>
          <InputGroup label="Workspace URL">
            <InputGroupText>https://</InputGroupText>
            <TextInput label="Subdomain" isLabelHidden value={domain} onChange={setDomain} />
            <InputGroupText>.openseat.app</InputGroupText>
          </InputGroup>
          <InputGroup label="Budget" description="Bidders see this as a ceiling.">
            <InputGroupText>$</InputGroupText>
            <TextInput label="Amount" isLabelHidden value={price} onChange={setPrice} />
            <InputGroupText>USD</InputGroupText>
          </InputGroup>
          <InputGroup label="Share link" size="sm">
            <TextInput label="Link" isLabelHidden value="openseat.app/r/1043" onChange={() => undefined} isReadOnly />
            <Button label="Copy" size="sm" icon={<Icon icon={icons.link} />} />
          </InputGroup>
        </Stack>
      </Preview>

      <Preview align="start" label="Enter to submit" description="onEnter turns a field into a quick-add line.">
        <Stack gap={2} width={FIELD_WIDTH}>
          <TextInput
            label="Add a requirement"
            value={draft}
            onChange={setDraft}
            placeholder="Type and press Enter"
            onEnter={() => {
              if (!draft.trim()) return;
              setEntered((all) => [...all, draft.trim()]);
              setDraft("");
            }}
          />
          {entered.length ? (
            entered.map((item, index) => (
              <Text key={index} display="block">
                {index + 1}. {item}
              </Text>
            ))
          ) : (
            <Caption>Nothing added yet.</Caption>
          )}
        </Stack>
      </Preview>

      <Preview label="Sign-in form" description="Fields at lg size in a card, with widths set by the form.">
        <Card maxWidth={380}>
          <Stack gap={4}>
            <Stack gap={1}>
              <Heading level={3}>Welcome back</Heading>
              <Text color="secondary">Sign in to see your rooms.</Text>
            </Stack>
            <FormLayout>
              <TextInput label="Email" type="email" size="lg" value={email} onChange={setEmail} width="100%" />
              <TextInput label="Password" type="password" size="lg" value={password} onChange={setPassword} width="100%" />
            </FormLayout>
            <HStack hAlign="between" vAlign="center">
              <Button label="Forgot password?" variant="ghost" size="sm" />
              <Button label="Sign in" variant="primary" size="lg" />
            </HStack>
          </Stack>
        </Card>
      </Preview>
    </Examples>
  );
}
