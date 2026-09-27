"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  EmptyState,
  GridColumn,
  GridSystem,
  HStack,
  Icon,
  List,
  ListItem,
  Stack,
  Tab,
  TabList,
  Text,
  TextInput,
  icons,
} from "@openseat/design-system";
import { JobDetail } from "@/components/job-detail";
import { INITIAL_SAVED_JOB_IDS } from "@/lib/account";
import { JOBS, SOURCE_LABEL, WORKPLACE_LABEL, type Job, type JobSource, type Seniority, type Workplace } from "@/lib/jobs";

const TITLE_WIDTH = 360;
const LOCATION_WIDTH = 280;
const ANY = "Any";

const TABS = [
  { value: "all", label: "All" },
  { value: "recommended", label: "Recommended" },
  { value: "saved", label: "Saved" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const WORKPLACES = [ANY, "Remote", "Hybrid", "On-site"] as const;
const SENIORITY = [ANY, "Junior", "Mid", "Senior", "Lead"] as const;
const SOURCES = [ANY, "Posted here", "Aggregated", "Hidden job"] as const;

const WORKPLACE_BY_LABEL: Record<string, Workplace | null> = {
  Remote: "remote",
  Hybrid: "hybrid",
  "On-site": "onsite",
};

const SOURCE_BY_LABEL: Record<string, JobSource | null> = {
  "Posted here": "direct",
  Aggregated: "aggregated",
  "Hidden job": "scouted",
};

function choiceItems(options: readonly string[], current: string, onPick: (value: string) => void) {
  return options.map((option) => ({
    label: option,
    endContent: option === current ? <Icon icon={icons.check} color="accent" /> : undefined,
    onClick: () => onPick(option),
  }));
}

function matches(job: Job, query: string, place: string, workplace: string, seniority: string, source: string) {
  const q = query.trim().toLowerCase();
  const loc = place.trim().toLowerCase();
  const text = `${job.title} ${job.company} ${job.summary}`.toLowerCase();
  if (q && !text.includes(q)) return false;
  if (loc && !`${job.location} ${WORKPLACE_LABEL[job.workplace]}`.toLowerCase().includes(loc)) return false;
  const workplaceValue = WORKPLACE_BY_LABEL[workplace];
  if (workplaceValue && job.workplace !== workplaceValue) return false;
  if (seniority !== ANY && job.seniority !== (seniority as Seniority)) return false;
  const sourceValue = SOURCE_BY_LABEL[source];
  if (sourceValue && job.source !== sourceValue) return false;
  return true;
}

export function JobBoard() {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [tab, setTab] = useState<TabValue>("all");
  const [workplace, setWorkplace] = useState<string>(ANY);
  const [seniority, setSeniority] = useState<string>(ANY);
  const [source, setSource] = useState<string>(ANY);
  const [savedIds, setSavedIds] = useState<string[]>(INITIAL_SAVED_JOB_IDS);
  const [selectedId, setSelectedId] = useState(JOBS[0].id);

  const visible = useMemo(() => {
    return JOBS.filter((job) => {
      if (tab === "recommended" && job.match == null) return false;
      if (tab === "saved" && !savedIds.includes(job.id)) return false;
      return matches(job, title, location, workplace, seniority, source);
    });
  }, [tab, savedIds, title, location, workplace, seniority, source]);

  const selected = visible.find((job) => job.id === selectedId) ?? visible[0];

  const toggleSave = (id: string) => {
    setSavedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <Stack gap={5}>
      <Card variant="muted">
        <HStack gap={3} vAlign="end" wrap="wrap">
          <TextInput
            label="Job title, skill, or company"
            placeholder="Product designer"
            value={title}
            onChange={setTitle}
            startIcon={<Icon icon={icons.search} />}
            hasClear
            width={TITLE_WIDTH}
          />
          <TextInput
            label="City or remote"
            placeholder="Chicago or remote"
            value={location}
            onChange={setLocation}
            startIcon={<Icon icon={icons.pin} />}
            hasClear
            width={LOCATION_WIDTH}
          />
          <Button label="Search" variant="primary" />
        </HStack>
      </Card>

      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <TabList aria-label="Job lists" value={tab} onChange={(value) => setTab(value as TabValue)}>
          {TABS.map((item) => (
            <Tab key={item.value} value={item.value} label={item.label} />
          ))}
        </TabList>
        <HStack gap={2} wrap="wrap">
          <DropdownMenu
            button={{ label: workplace === ANY ? "Workplace" : workplace, variant: "secondary", size: "sm" }}
            items={choiceItems(WORKPLACES, workplace, setWorkplace)}
          />
          <DropdownMenu
            button={{ label: seniority === ANY ? "Seniority" : seniority, variant: "secondary", size: "sm" }}
            items={choiceItems(SENIORITY, seniority, setSeniority)}
          />
          <DropdownMenu
            button={{ label: source === ANY ? "Source" : source, variant: "secondary", size: "sm" }}
            items={choiceItems(SOURCES, source, setSource)}
          />
        </HStack>
      </HStack>

      <Text type="supporting" color="secondary">
        {visible.length} {visible.length === 1 ? "job" : "jobs"}
      </Text>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Icon icon={icons.search} size="lg" color="secondary" />}
          title="No jobs match"
          description="Try a shorter title, or clear a filter."
          actions={
            <Button
              label="Clear filters"
              variant="secondary"
              onClick={() => {
                setTitle("");
                setLocation("");
                setWorkplace(ANY);
                setSeniority(ANY);
                setSource(ANY);
              }}
            />
          }
        />
      ) : (
        <GridSystem gap={4}>
          <GridColumn span={12} lg={5}>
            <Card padding={2}>
              <List>
                {visible.map((job) => (
                  <ListItem
                    key={job.id}
                    label={job.title}
                    description={`${job.company} · ${job.location}`}
                    isSelected={selected?.id === job.id}
                    onClick={() => setSelectedId(job.id)}
                    endContent={
                      <HStack gap={2} vAlign="center">
                        {job.source === "scouted" ? <Badge label="Hidden" variant="purple" /> : null}
                        <Text type="supporting" color="secondary">
                          {job.salary}
                        </Text>
                      </HStack>
                    }
                  />
                ))}
              </List>
            </Card>
          </GridColumn>
          <GridColumn span={12} lg={7}>
            {selected ? (
              <Card>
                <JobDetail
                  job={selected}
                  saved={savedIds.includes(selected.id)}
                  onToggleSave={() => toggleSave(selected.id)}
                  showPageLink
                />
              </Card>
            ) : null}
          </GridColumn>
        </GridSystem>
      )}
    </Stack>
  );
}
