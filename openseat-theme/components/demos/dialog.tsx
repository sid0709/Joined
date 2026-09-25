"use client";

import { useState } from "react";
import {
  AlertDialog,
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogHeader,
  FormLayout,
  HStack,
  Icon,
  Layout,
  LayoutContent,
  LayoutFooter,
  Selector,
  Stack,
  Text,
  TextArea,
  TextInput,
  icons,
  useImperativeAlertDialog,
  useImperativeDialog,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview, Row } from "./shared";

const CLOSE_MS = 900;
const DIALOG_WIDTH = 480;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function DialogDemo() {
  const [confirm, setConfirm] = useState(false);
  const [form, setForm] = useState(false);
  const [info, setInfo] = useState(false);
  const [full, setFull] = useState(false);
  const [alert, setAlert] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [title, setTitle] = useState("Brand refresh");
  const [brief, setBrief] = useState("");
  const [visibility, setVisibility] = useState("sealed");
  const [log, setLog] = useState("");
  const dialog = useImperativeDialog();
  const alertDialog = useImperativeAlertDialog();

  return (
    <Examples>
      <Preview align="start" label="Confirm a decision" description="Header, a short body, and two buttons — the action names what happens.">
        <Row>
          <Button label="Close room" variant="destructive" onClick={() => setConfirm(true)} isDisabled={closed} />
          {closed && <Badge label="Closed" variant="neutral" />}
          {closed && <Button label="Reopen" size="sm" variant="ghost" onClick={() => setClosed(false)} />}
        </Row>
        <Dialog isOpen={confirm} onOpenChange={setConfirm} width={DIALOG_WIDTH}>
          <Layout
            height="auto"
            header={<DialogHeader title="Close this room?" subtitle="Brand refresh" onOpenChange={setConfirm} />}
            content={
              <LayoutContent>
                <Text>People can no longer bid. Bids you already have will open for review.</Text>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button label="Cancel" variant="ghost" onClick={() => setConfirm(false)} />
                  <Button
                    label="Close room"
                    variant="destructive"
                    isLoading={closing}
                    onClick={async () => {
                      setClosing(true);
                      await wait(CLOSE_MS);
                      setClosing(false);
                      setConfirm(false);
                      setClosed(true);
                    }}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      </Preview>

      <Preview align="start" label="Alert dialog" description="AlertDialog is the short form: title, description, and one action.">
        <Row>
          <Button label="Delete draft" variant="destructive" onClick={() => setAlert(true)} />
        </Row>
        <AlertDialog
          isOpen={alert}
          onOpenChange={setAlert}
          title="Delete this draft?"
          description="The brief and its attachments will be removed. This can’t be undone."
          actionLabel="Delete"
          actionVariant="destructive"
          onAction={() => setAlert(false)}
        />
      </Preview>

      <Preview align="start" label="Form dialog" description="purpose=&quot;form&quot; keeps focus inside and warns before losing input.">
        <Row>
          <Button label="Edit room" icon={<Icon icon={icons.edit} />} onClick={() => setForm(true)} />
          <Caption>{title}</Caption>
        </Row>
        <Dialog isOpen={form} onOpenChange={setForm} purpose="form" width={DIALOG_WIDTH}>
          <Layout
            height="auto"
            header={<DialogHeader title="Edit room" onOpenChange={setForm} hasDivider />}
            content={
              <LayoutContent>
                <FormLayout>
                  <TextInput label="Title" value={title} onChange={setTitle} isRequired />
                  <TextArea label="Brief" value={brief} onChange={setBrief} rows={3} />
                  <Selector
                    label="Visibility"
                    value={visibility}
                    onChange={setVisibility}
                    options={[
                      { value: "sealed", label: "Sealed" },
                      { value: "open", label: "Open" },
                    ]}
                  />
                </FormLayout>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button label="Cancel" variant="ghost" onClick={() => setForm(false)} />
                  <Button label="Save" variant="primary" isDisabled={!title.trim()} onClick={() => setForm(false)} />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      </Preview>

      <Preview align="start" label="Info dialog" description="purpose=&quot;info&quot; closes on outside click — for details, not decisions.">
        <Row>
          <Button label="View bidder" variant="ghost" onClick={() => setInfo(true)} />
        </Row>
        <Dialog isOpen={info} onOpenChange={setInfo} purpose="info" width={400}>
          <Layout
            height="auto"
            header={<DialogHeader title="Dana Kim" subtitle="Copywriter · Portland" startContent={<Avatar name="Dana Kim" size="md" tooltip={false} />} onOpenChange={setInfo} />}
            content={
              <LayoutContent>
                <Stack gap={2}>
                  <Text>42 rooms won · 4.9 rating · replies in about 2 days.</Text>
                  <HStack gap={2}>
                    <Badge label="Branding" variant="blue" />
                    <Badge label="Copywriting" variant="purple" />
                  </HStack>
                </Stack>
              </LayoutContent>
            }
          />
        </Dialog>
      </Preview>

      <Preview align="start" label="Fullscreen" description="variant=&quot;fullscreen&quot; for immersive tasks like comparing every bid.">
        <Row>
          <Button label="Compare bids" variant="primary" onClick={() => setFull(true)} />
        </Row>
        <Dialog isOpen={full} onOpenChange={setFull} variant="fullscreen">
          <Layout
            header={<DialogHeader title="Compare bids" subtitle="Brand refresh · 3 bids" onOpenChange={setFull} hasDivider />}
            content={
              <LayoutContent>
                <Stack gap={3}>
                  {PEOPLE.slice(0, 3).map((p, i) => (
                    <HStack key={p.name} gap={3} vAlign="center" hAlign="between">
                      <HStack gap={2} vAlign="center">
                        <Avatar name={p.name} size="sm" tooltip={false} />
                        <Text weight="semibold">{p.name}</Text>
                      </HStack>
                      <Text hasTabularNumbers>${(2400 + i * 350).toLocaleString()}</Text>
                    </HStack>
                  ))}
                </Stack>
              </LayoutContent>
            }
          />
        </Dialog>
      </Preview>

      <Preview align="start" label="Imperative dialogs" description="useImperativeDialog and useImperativeAlertDialog open a dialog from any handler without wiring state.">
        <Stack gap={2}>
          <Row>
            <Button
              label="Show tips"
              onClick={() =>
                dialog.show(
                  <Layout
                    height="auto"
                    header={<DialogHeader title="Tips for a great brief" onOpenChange={(o) => !o && dialog.hide()} />}
                    content={
                      <LayoutContent>
                        <Text>Say what done looks like, give a budget range, and set a deadline at least a week out.</Text>
                      </LayoutContent>
                    }
                  />,
                )
              }
            />
            <Button
              label="Leave room"
              variant="destructive"
              onClick={() =>
                alertDialog.show({
                  title: "Leave this room?",
                  description: "You’ll lose access to the brief and your bid will be withdrawn.",
                  actionLabel: "Leave",
                  actionVariant: "destructive",
                  onAction: () => setLog("Left the room."),
                })
              }
            />
          </Row>
          <Caption>{log || "Nothing yet."}</Caption>
          {dialog.element}
          {alertDialog.element}
        </Stack>
      </Preview>
    </Examples>
  );
}
