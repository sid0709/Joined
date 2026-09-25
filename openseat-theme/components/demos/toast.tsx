"use client";

import { useRef, useState } from "react";
import {
  Button,
  Card,
  HStack,
  Icon,
  Stack,
  Text,
  ToastViewport,
  icons,
  useToast,
  type ToastDismissFn,
  type ToastPosition,
} from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const SAVE_MS = 900;
const SHORT_MS = 2000;
const LONG_MS = 8000;
const POSITIONS: ToastPosition[] = ["topStart", "topEnd", "bottomStart", "bottomEnd"];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Basics() {
  const toast = useToast();
  return (
    <Row>
      <Button label="Info toast" onClick={() => toast({ body: "Invite sent to Alex Rivera." })} />
      <Button label="Error toast" variant="destructive" onClick={() => toast({ body: "Couldn’t send the invite.", type: "error" })} />
    </Row>
  );
}

function Actions() {
  const toast = useToast();
  const [archived, setArchived] = useState(false);
  return (
    <Stack gap={2} hAlign="start">
      <Row>
        <Button
          label="Archive room"
          isDisabled={archived}
          onClick={() => {
            setArchived(true);
            toast({
              body: "Room archived.",
              endContent: <Button label="Undo" size="sm" variant="ghost" onClick={() => setArchived(false)} />,
            });
          }}
        />
        <Button
          label="Failed upload"
          onClick={() =>
            toast({
              body: "brief.pdf didn’t upload.",
              type: "error",
              endContent: <Button label="Retry" size="sm" variant="ghost" icon={<Icon icon={icons.refresh} />} />,
            })
          }
        />
      </Row>
      <Caption>{archived ? "Brand refresh is archived." : "Brand refresh is active."}</Caption>
    </Stack>
  );
}

function Timing() {
  const toast = useToast();
  return (
    <Row>
      <Button label="2 seconds" onClick={() => toast({ body: "Copied link.", autoHideDuration: SHORT_MS })} />
      <Button label="8 seconds" onClick={() => toast({ body: "Deadline extended to Monday.", autoHideDuration: LONG_MS })} />
      <Button label="Until dismissed" onClick={() => toast({ body: "Payment method expired. Update it in settings.", type: "error", isAutoHide: false })} />
    </Row>
  );
}

function Dedup() {
  const toast = useToast();
  const [count, setCount] = useState(0);
  return (
    <Stack gap={2} hAlign="start">
      <Row>
        <Button
          label="Overwrite"
          onClick={() => {
            const n = count + 1;
            setCount(n);
            toast({ body: `${n} bid${n === 1 ? "" : "s"} received`, uniqueID: "bids", collisionBehavior: "overwrite" });
          }}
        />
        <Button label="Ignore repeats" onClick={() => toast({ body: "You’re offline.", uniqueID: "offline", collisionBehavior: "ignore", type: "error" })} />
      </Row>
      <Caption>Click either button several times — one toast updates or stays, never a pile.</Caption>
    </Stack>
  );
}

function Programmatic() {
  const toast = useToast();
  const dismiss = useRef<ToastDismissFn | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const save = async () => {
    dismiss.current = toast({ body: "Saving brief…", isAutoHide: false });
    await wait(SAVE_MS);
    dismiss.current?.();
    toast({ body: "Brief saved.", onHide: (reason) => setLog((l) => [`Hidden (${reason})`, ...l].slice(0, 3)) });
  };

  return (
    <Stack gap={2} hAlign="start">
      <Row>
        <Button label="Save brief" variant="primary" onClick={save} />
        <Button label="Dismiss current" variant="ghost" onClick={() => dismiss.current?.()} />
      </Row>
      <Caption>{log.length ? log.join(" · ") : "toast() returns a dismiss function; onHide says why it closed."}</Caption>
    </Stack>
  );
}

function PositionButton({ position }: { position: ToastPosition }) {
  const toast = useToast();
  return <Button label={position} size="sm" onClick={() => toast({ body: `Shown at ${position}` })} />;
}

export default function ToastDemo() {
  return (
    <Examples>
      <Preview align="start" label="Info and error" description="useToast() returns a function. OpenSeatProvider mounts the viewport for you.">
        <Basics />
      </Preview>

      <Preview align="start" label="Actions" description="endContent holds one quick action — Undo, Retry, or View.">
        <Actions />
      </Preview>

      <Preview align="start" label="Timing" description="autoHideDuration in ms, or isAutoHide={false} for messages that need a response.">
        <Timing />
      </Preview>

      <Preview align="start" label="De-duplicate" description="uniqueID with overwrite updates one toast; with ignore, repeats are dropped.">
        <Dedup />
      </Preview>

      <Preview align="start" label="Programmatic dismiss" description="Show a pending toast, then replace it when the work finishes.">
        <Programmatic />
      </Preview>

      <Preview align="start" label="Positions" description="A nested ToastViewport scopes position and stack size to part of the app.">
        <HStack gap={3} wrap="wrap">
          {POSITIONS.map((position) => (
            <ToastViewport key={position} position={position} maxVisible={2}>
              <PositionButton position={position} />
            </ToastViewport>
          ))}
        </HStack>
      </Preview>

      <Preview label="In a flow" description="Confirm what just happened without blocking the next step.">
        <Card maxWidth={420}>
          <FlowCard />
        </Card>
      </Preview>
    </Examples>
  );
}

function FlowCard() {
  const toast = useToast();
  const [invited, setInvited] = useState<string[]>([]);
  const people = ["Jordan Miles", "Alex Rivera", "Dana Kim"];
  return (
    <Stack gap={2}>
      {people.map((name) => (
        <HStack key={name} hAlign="between" vAlign="center">
          <Text>{name}</Text>
          <Button
            label={invited.includes(name) ? "Invited" : "Invite"}
            size="sm"
            variant={invited.includes(name) ? "ghost" : "secondary"}
            isDisabled={invited.includes(name)}
            onClick={() => {
              setInvited((all) => [...all, name]);
              toast({
                body: `Invite sent to ${name}.`,
                endContent: <Button label="Undo" size="sm" variant="ghost" onClick={() => setInvited((all) => all.filter((n) => n !== name))} />,
              });
            }}
          />
        </HStack>
      ))}
    </Stack>
  );
}
