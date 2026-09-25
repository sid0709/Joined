"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CheckboxInput,
  CheckboxList,
  CheckboxListItem,
  Heading,
  Icon,
  Stack,
  Text,
  icons,
} from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const PERMISSIONS = [
  { id: "view", label: "View the brief" },
  { id: "ask", label: "Ask questions" },
  { id: "bid", label: "Submit a bid" },
  { id: "files", label: "Download files" },
];
const DELIVERABLES = [
  { value: "logo", label: "Logo", description: "Primary mark and wordmark", price: "$900" },
  { value: "packaging", label: "Packaging", description: "Three blends, front and back", price: "$1,200" },
  { value: "signage", label: "Signage", description: "Two cafés, interior and exterior", price: "$700" },
  { value: "web", label: "Website", description: "Out of scope this round", price: "—", disabled: true },
];
const SAVE_MS = 700;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function CheckboxDemo() {
  const [sm, setSm] = useState(true);
  const [md, setMd] = useState(false);
  const [perms, setPerms] = useState<string[]>(["view", "ask"]);
  const [terms, setTerms] = useState(false);
  const [tried, setTried] = useState(false);
  const [scope, setScope] = useState<string[]>(["logo", "packaging"]);
  const [digest, setDigest] = useState(true);

  const all = perms.length === PERMISSIONS.length;
  const some = perms.length > 0 && !all;
  const total = DELIVERABLES.filter((d) => scope.includes(d.value)).reduce((sum, d) => sum + Number(d.price.replace(/[^\d]/g, "") || 0), 0);

  return (
    <Examples>
      <Preview align="start" label="Sizes" description="sm for dense lists and tables; md is the default.">
        <Stack gap={2}>
          <CheckboxInput size="sm" label="Small" value={sm} onChange={setSm} />
          <CheckboxInput size="md" label="Medium" value={md} onChange={setMd} />
        </Stack>
      </Preview>

      <Preview align="start" label="Description and icon" description="A second line explains the choice; labelIcon adds a hint of meaning.">
        <Stack gap={3}>
          <CheckboxInput label="Seal bids until the deadline" description="Nobody sees a bid, including you, until the room closes." value labelIcon={<Icon icon={icons.lock} size="sm" />} onChange={() => undefined} />
          <CheckboxInput label="Email me a daily digest" description="One summary at 8 AM instead of one email per bid." value={digest} onChange={setDigest} labelIcon={<Icon icon={icons.mail} size="sm" />} />
        </Stack>
      </Preview>

      <Preview align="start" label="Select all" description="value=&quot;indeterminate&quot; when some, not all, children are checked.">
        <Stack gap={2}>
          <CheckboxInput label="All permissions" value={all ? true : some ? "indeterminate" : false} onChange={(checked) => setPerms(checked ? PERMISSIONS.map((p) => p.id) : [])} />
          <Stack gap={2}>
            {PERMISSIONS.map((p) => (
              <CheckboxInput
                key={p.id}
                label={p.label}
                value={perms.includes(p.id)}
                onChange={(checked) => setPerms((c) => (checked ? [...c, p.id] : c.filter((x) => x !== p.id)))}
              />
            ))}
          </Stack>
          <Caption>
            {perms.length} of {PERMISSIONS.length} granted
          </Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Required with an error" description="Show the status only after someone tries to continue.">
        <Stack gap={3} hAlign="start">
          <CheckboxInput
            label="I agree to the room rules"
            isRequired
            value={terms}
            onChange={setTerms}
            status={tried && !terms ? { type: "error", message: "Agree to the rules to submit your bid." } : undefined}
          />
          <Button label="Submit bid" variant="primary" onClick={() => setTried(true)} />
        </Stack>
      </Preview>

      <Preview align="start" label="Async save" description="changeAction shows a spinner while the setting saves.">
        <CheckboxInput
          label="Notify invitees when I extend the deadline"
          value={digest}
          changeAction={async (checked) => {
            await wait(SAVE_MS);
            setDigest(checked);
          }}
        />
      </Preview>

      <Preview align="start" label="Read-only and disabled">
        <Stack gap={2}>
          <CheckboxInput label="Verified identity" value isReadOnly />
          <CheckboxInput label="Escrow (paid plans)" value={false} isDisabled disabledMessage="Upgrade to Team to use escrow." />
        </Stack>
      </Preview>

      <Preview label="Checkbox list" description="A labeled group with descriptions, end content, dividers, and a disabled item.">
        <Card maxWidth={480}>
          <Stack gap={3}>
            <CheckboxList label="Deliverables" description="Pick what this room covers." value={scope} onChange={setScope} hasDividers>
              {DELIVERABLES.map((d) => (
                <CheckboxListItem
                  key={d.value}
                  value={d.value}
                  label={d.label}
                  description={d.description}
                  isDisabled={d.disabled}
                  endContent={<Text color="secondary" hasTabularNumbers>{d.price}</Text>}
                />
              ))}
            </CheckboxList>
            <Heading level={4}>Estimated total: ${total.toLocaleString()}</Heading>
          </Stack>
        </Card>
      </Preview>

      <Preview align="start" label="List density" description="compact, balanced, and spacious.">
        <Stack gap={4}>
          {(["compact", "balanced", "spacious"] as const).map((density) => (
            <CheckboxList key={density} label={density} density={density} value={scope} onChange={setScope}>
              {DELIVERABLES.slice(0, 3).map((d) => (
                <CheckboxListItem key={d.value} value={d.value} label={d.label} endContent={d.value === "logo" ? <Badge label="Core" variant="info" /> : undefined} />
              ))}
            </CheckboxList>
          ))}
        </Stack>
      </Preview>
    </Examples>
  );
}
