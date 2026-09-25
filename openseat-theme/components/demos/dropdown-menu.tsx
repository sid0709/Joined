"use client";

import { useState } from "react";
import {
  Badge,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSubMenu,
  Icon,
  Stack,
  Text,
  icons,
} from "@openseat/design-system";
import { Caption, Examples, Preview, Row } from "./shared";

const SORTS = ["Newest", "Budget: high to low", "Budget: low to high", "Most bids"];
const STATUSES = ["Open", "Review", "Awarded", "Archived"];

export default function DropdownMenuDemo() {
  const [last, setLast] = useState<string | null>(null);
  const [sort, setSort] = useState(SORTS[0]);
  const [statuses, setStatuses] = useState<string[]>(["Open", "Review"]);
  const [open, setOpen] = useState(false);

  const run = (label: string) => () => setLast(label);

  return (
    <Examples>
      <Preview align="start" label="Basic" description="A trigger-anchored list of commands.">
        <Stack gap={2} hAlign="start">
          <Row>
            <DropdownMenu
              button={{ label: "Actions" }}
              items={[
                { label: "Edit", onClick: run("Edit") },
                { label: "Duplicate", onClick: run("Duplicate") },
                { label: "Archive", onClick: run("Archive") },
              ]}
            />
            <DropdownMenu
              button={{ label: "Create", variant: "primary", icon: <Icon icon={icons.plus} /> }}
              items={[
                { label: "Sealed room", icon: icons.lock, onClick: run("Sealed room") },
                { label: "Open room", icon: icons.home, onClick: run("Open room") },
                { label: "Invite link", icon: icons.link, onClick: run("Invite link") },
              ]}
            />
            <DropdownMenu
              button={{ label: "View", variant: "ghost" }}
              items={[
                { label: "Grid", icon: icons.grid, onClick: run("Grid") },
                { label: "List", icon: icons.list, onClick: run("List") },
              ]}
            />
          </Row>
          <Caption>{last ? `Last action: ${last}` : "Pick something from a menu."}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Icons, descriptions, and shortcuts">
        <DropdownMenu
          button={{ label: "Room", icon: <Icon icon={icons.seat} /> }}
          menuWidth={280}
          items={[
            { label: "Rename", description: "Change the room title", icon: icons.edit, endContent: <Text type="supporting" color="secondary">⌘R</Text>, onClick: run("Rename") },
            { label: "Share", description: "Invite bidders by link", icon: icons.share, endContent: <Text type="supporting" color="secondary">⌘S</Text>, onClick: run("Share") },
            { label: "Download brief", description: "PDF, 2.4 MB", icon: icons.download, onClick: run("Download") },
            { type: "divider" },
            { label: "Delete room", description: "Removes all bids", icon: icons.trash, variant: "destructive", onClick: run("Delete") },
          ]}
        />
      </Preview>

      <Preview align="start" label="Sections">
        <DropdownMenu
          button={{ label: "File", variant: "ghost" }}
          items={[
            {
              type: "section",
              title: "Create",
              items: [
                { label: "New room", icon: icons.plus, onClick: run("New room") },
                { label: "New folder", icon: icons.folder, onClick: run("New folder") },
              ],
            },
            {
              type: "section",
              title: "Manage",
              items: [
                { label: "Move", icon: icons.folderOpen, onClick: run("Move") },
                { label: "Export", icon: icons.upload, onClick: run("Export") },
              ],
            },
          ]}
        />
      </Preview>

      <Preview align="start" label="Single choice" description="Show the current choice in the trigger and a check in the list.">
        <DropdownMenu
          button={{ label: `Sort: ${sort}`, variant: "secondary", icon: <Icon icon={icons.sort} /> }}
          items={SORTS.map((option) => ({
            label: option,
            endContent: option === sort ? <Icon icon={icons.check} color="accent" /> : undefined,
            onClick: () => setSort(option),
          }))}
        />
      </Preview>

      <Preview align="start" label="Multiple choice" description="Keep the menu open while toggling filters.">
        <Stack gap={2} hAlign="start">
          <DropdownMenu
            button={{
              label: "Status",
              icon: <Icon icon={icons.filter} />,
              endContent: statuses.length ? <Badge label={String(statuses.length)} variant="info" /> : undefined,
            }}
            items={STATUSES.map((status) => ({
              label: status,
              hasCloseOnSelect: false,
              icon: statuses.includes(status) ? icons.check : undefined,
              onClick: () => setStatuses((current) => (current.includes(status) ? current.filter((s) => s !== status) : [...current, status])),
            }))}
          />
          <Caption>Showing: {statuses.length ? statuses.join(", ") : "nothing"}</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Submenu">
        <DropdownMenu button={{ label: "Move to" }}>
          <DropdownMenuItem label="Inbox" icon={icons.mail} onClick={run("Inbox")} />
          <DropdownMenuSubMenu label="Projects" icon={icons.folder}>
            <DropdownMenuItem label="Brand refresh" onClick={run("Brand refresh")} />
            <DropdownMenuItem label="Landing page" onClick={run("Landing page")} />
            <DropdownMenuItem label="Motion system" onClick={run("Motion system")} />
          </DropdownMenuSubMenu>
          <DropdownMenuItem label="Archive" icon={icons.bookmark} onClick={run("Archive")} />
        </DropdownMenu>
      </Preview>

      <Preview align="start" label="Disabled items" description="Keep actions visible but unavailable so people learn they exist.">
        <DropdownMenu
          button={{ label: "Manage team" }}
          items={[
            { label: "Invite member", icon: icons.user, onClick: run("Invite") },
            { label: "Edit roles", icon: icons.settings, onClick: run("Edit roles") },
            { type: "divider" },
            { label: "Transfer ownership", isDisabled: true },
            { label: "Delete team", variant: "destructive", isDisabled: true },
          ]}
        />
      </Preview>

      <Preview align="start" label="Triggers" description="Any Button variant, icon-only, or no chevron.">
        <Row>
          <DropdownMenu button={{ label: "Primary", variant: "primary" }} items={[{ label: "One" }, { label: "Two" }]} />
          <DropdownMenu button={{ label: "Secondary" }} items={[{ label: "One" }, { label: "Two" }]} />
          <DropdownMenu button={{ label: "Ghost", variant: "ghost" }} items={[{ label: "One" }, { label: "Two" }]} />
          <DropdownMenu button={{ label: "Small", size: "sm" }} items={[{ label: "One" }, { label: "Two" }]} />
          <DropdownMenu
            button={{ label: "Notifications", isIconOnly: true, variant: "ghost", icon: <Icon icon={icons.bell} /> }}
            hasChevron={false}
            items={[{ label: "Mark all read" }, { label: "Settings" }]}
          />
        </Row>
      </Preview>

      <Preview align="start" label="Controlled and placement">
        <Stack gap={2} hAlign="start">
          <Row>
            <DropdownMenu
              button={{ label: open ? "Close menu" : "Open menu" }}
              isMenuOpen={open}
              onOpenChange={setOpen}
              items={[{ label: "Stays in sync with state" }, { label: "Close me", onClick: () => setOpen(false) }]}
            />
            <DropdownMenu button={{ label: "Opens above", variant: "ghost" }} placement="above" items={[{ label: "One" }, { label: "Two" }]} />
          </Row>
          <Caption>Menu is {open ? "open" : "closed"}.</Caption>
        </Stack>
      </Preview>

      <Preview align="start" label="Bottom sheet" description="On touch layouts the same menu can rise from the bottom.">
        <DropdownMenu
          button={{ label: "Share room", icon: <Icon icon={icons.share} /> }}
          presentation="bottom-sheet"
          items={[
            { label: "Copy link", icon: icons.link, onClick: run("Copy link") },
            { label: "Email", icon: icons.mail, onClick: run("Email") },
            { label: "Send to bidder", icon: icons.send, onClick: run("Send") },
          ]}
        />
      </Preview>
    </Examples>
  );
}
