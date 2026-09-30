"use client";

import { useMemo, useState } from "react";

import type { PackageTier, PoolJob, Task } from "@/src/shared/types/marketplace";

import { useHunter } from "@/src/client/context/HunterContext";
import { DateField } from "@/src/shared/kit/Fields";
import { money, plural } from "@/src/shared/lib/format";
import { Banner, Button, Modal, Select, TextArea } from "@/src/shared/marketplace-ui";
import { isoAhead } from "@/src/shared/mock/clock";

const DEFAULT_DUE_DAYS = 3;

/** The package on this task that covers the most of the selected links. */
function bestPackage(task: Task | undefined, jobs: PoolJob[], packages: PackageTier[]): string {
  if (!task) return "";
  const scored = task.packageLines.map((line) => {
    const tier = packages.find((item) => item.id === line.packageId);
    return {
      id: line.packageId,
      covered: jobs.filter((job) => tier?.ats.includes(job.ats)).length,
    };
  });
  return scored.sort((a, b) => b.covered - a.covered)[0]?.id ?? "";
}

interface AssignDialogProps {
  open: boolean;
  jobs: PoolJob[];
  presetTaskId?: string;
  presetBidderId?: string;
  onClose: () => void;
  onAssigned: (assignmentId: string, count: number) => void;
}

/** Hand a set of pool links to one connected bidder under one package. */
export function AssignDialog({
  open,
  jobs,
  presetTaskId,
  presetBidderId,
  onClose,
  onAssigned,
}: AssignDialogProps) {
  const { tasks, inquiries, bidderById, packages, assignJobs } = useHunter();
  const assignable = tasks.filter(
    (task) =>
      (task.status === "in_progress" || task.status === "open") &&
      inquiries.some((item) => item.taskId === task.id && item.status === "connected"),
  );
  const firstBidderFor = (id: string) =>
    inquiries.find(
      (item) =>
        item.taskId === id &&
        item.status === "connected" &&
        (!presetBidderId || item.bidderId === presetBidderId),
    )?.bidderId ?? "";
  const startTask = assignable.find((item) => item.id === presetTaskId);
  const [taskId, setTaskId] = useState(startTask?.id ?? "");
  const [bidderId, setBidderId] = useState(startTask ? firstBidderFor(startTask.id) : "");
  const [packageId, setPackageId] = useState(bestPackage(startTask, jobs, packages));
  const [due, setDue] = useState(isoAhead(DEFAULT_DUE_DAYS).slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const task = tasks.find((item) => item.id === taskId);
  const bidders = task
    ? inquiries.filter((item) => item.taskId === task.id && item.status === "connected")
    : [];
  const lines = task?.packageLines ?? [];
  const line = lines.find((item) => item.packageId === packageId);
  const tier = packages.find((item) => item.id === packageId);

  const matching = useMemo(
    () => (tier ? jobs.filter((job) => tier.ats.includes(job.ats)) : []),
    [jobs, tier],
  );
  const skipped = jobs.length - matching.length;
  const cost = matching.length * (line?.rate ?? 0);

  const pickTask = (nextTaskId: string) => {
    setTaskId(nextTaskId);
    setBidderId(firstBidderFor(nextTaskId));
    setPackageId(
      bestPackage(
        tasks.find((item) => item.id === nextTaskId),
        jobs,
        packages,
      ),
    );
    setError(null);
  };

  const submit = () => {
    const result = assignJobs({
      taskId,
      bidderId,
      packageId,
      jobIds: matching.map((job) => job.id),
      dueAt: new Date(due).toISOString(),
      note: note.trim(),
    });
    if (!result.ok || !result.assignmentId)
      return setError(result.error ?? "Could not assign these links.");
    onAssigned(result.assignmentId, matching.length);
    setNote("");
    setError(null);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign ${plural(jobs.length, "link")}`}
      footer={
        <div className="hx-row hx-row-between" style={{ padding: "var(--space-4)" }}>
          <span className="hx-small hx-muted">
            {tier
              ? `${plural(matching.length, "link")} · ${money(cost)} when QA passes`
              : "Choose a task and package"}
          </span>
          <div className="hx-row">
            <Button variant="ghost" label="Cancel" onClick={onClose} />
            <Button
              variant="primary"
              label="Assign to bidder"
              disabled={!matching.length || !bidderId}
              onClick={submit}
            />
          </div>
        </div>
      }
    >
      <div className="hx-inline-form" style={{ padding: "var(--space-4)" }}>
        {error && <Banner tone="danger" title={error} />}
        {!assignable.length && (
          <Banner
            tone="warning"
            title="No task has a connected bidder yet"
            description="Accept a bidder's inquiry first, then assign links to them."
          />
        )}
        <Select
          label="Task"
          value={taskId}
          placeholder="Choose a task"
          onChange={(event) => pickTask(event.target.value)}
        >
          {assignable.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </Select>
        <div className="hx-field-grid">
          <Select
            label="Bidder"
            value={bidderId}
            placeholder="Choose a bidder"
            disabled={!task}
            onChange={(event) => setBidderId(event.target.value)}
          >
            {bidders.map((item) => (
              <option key={item.bidderId} value={item.bidderId}>
                {bidderById(item.bidderId)?.name}
              </option>
            ))}
          </Select>
          <Select
            label="Package"
            value={packageId}
            placeholder="Choose a package"
            disabled={!task}
            onChange={(event) => setPackageId(event.target.value)}
          >
            {lines.map((item) => (
              <option key={item.packageId} value={item.packageId}>
                {packages.find((p) => p.id === item.packageId)?.name} · {money(item.rate)}
              </option>
            ))}
          </Select>
        </div>
        {tier && skipped > 0 && (
          <Banner
            tone="warning"
            title={`${plural(skipped, "selected link")} will be left out`}
            description={`${tier.name} only covers ${tier.ats.join(" and ")} links. The rest stay in the pool.`}
          />
        )}
        <DateField label="Due date" value={due} onChange={setDue} />
        <TextArea
          label="Note for the bidder (optional)"
          placeholder="Resume version, answers to reuse, anything to watch for"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Modal>
  );
}
