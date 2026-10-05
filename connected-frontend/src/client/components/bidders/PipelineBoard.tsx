"use client";

import { KanbanBoard, type KanbanColumn, type KanbanLane } from "sid-ui";

import type { HiringStage, Inquiry } from "@/src/shared/types/marketplace";

import { BidderTicket } from "@/src/client/components/bidders/BidderTicket";
import { useHunter } from "@/src/client/context/HunterContext";
import { HIRING_STAGES } from "@/src/client/data/pipeline";

const COLUMN_WIDTH = 296;

export interface PipelineItem {
  id: string;
  columnId: HiringStage;
  laneId: string;
}

interface PipelineBoardProps {
  inquiries: Inquiry[];
  byTask: boolean;
  showDeclined: boolean;
  onOpen: (inquiryId: string) => void;
  onSchedule: (inquiryId: string) => void;
  /** Called after a card lands in a new column. */
  onMoved: (inquiryId: string, from: HiringStage, to: HiringStage) => void;
}

/** The hiring pipeline: each ticket is a bidder, each column a stage. Drag to advance or decline. */
export function PipelineBoard({
  inquiries,
  byTask,
  showDeclined,
  onOpen,
  onSchedule,
  onMoved,
}: PipelineBoardProps) {
  const { tasks, bidderById, taskById, applyPipeline } = useHunter();
  const stages = HIRING_STAGES.filter((stage) => showDeclined || stage.id !== "declined");
  const columns: KanbanColumn[] = stages.map((stage) => ({ id: stage.id, title: stage.title }));

  const visible = inquiries.filter((item) => showDeclined || item.stage !== "declined");
  const items: PipelineItem[] = visible.map((item) => ({
    id: item.id,
    columnId: item.stage,
    laneId: byTask ? item.taskId : "all",
  }));

  const lanes: KanbanLane[] | undefined = byTask
    ? tasks
        .filter((task) => visible.some((item) => item.taskId === task.id))
        .map((task) => {
          const connected = inquiries.filter(
            (item) => item.taskId === task.id && item.stage === "connected",
          ).length;
          return {
            id: task.id,
            title: task.title,
            subtitle: `${connected}/${task.bidderSlots} bidder slots filled`,
          };
        })
    : undefined;

  const slotsFull = (taskId: string, ignoreId: string) => {
    const task = taskById(taskId);
    const connected = inquiries.filter(
      (item) => item.taskId === taskId && item.stage === "connected" && item.id !== ignoreId,
    ).length;
    return Boolean(task && connected >= task.bidderSlots);
  };

  return (
    <KanbanBoard<PipelineItem>
      label="Bidder hiring pipeline"
      columns={columns}
      items={items}
      lanes={lanes}
      columnWidth={COLUMN_WIDTH}
      emptyText="No bidders here"
      getItemLabel={(item) =>
        bidderById(inquiries.find((entry) => entry.id === item.id)?.bidderId ?? "")?.name ??
        "Bidder"
      }
      canDrop={(item, to) => {
        const inquiry = inquiries.find((entry) => entry.id === item.id);
        if (!inquiry) return false;
        if (byTask && to.laneId && to.laneId !== inquiry.taskId) return false;
        return to.columnId === "connected" && item.columnId !== "connected"
          ? !slotsFull(inquiry.taskId, inquiry.id)
          : true;
      }}
      onItemsChange={(next, move) => {
        applyPipeline(next.map((item) => ({ id: item.id, stage: item.columnId })));
        if (move.from.columnId !== move.to.columnId)
          onMoved(move.itemId, move.from.columnId as HiringStage, move.to.columnId as HiringStage);
      }}
      renderItem={(item) => {
        const inquiry = inquiries.find((entry) => entry.id === item.id);
        const bidder = inquiry && bidderById(inquiry.bidderId);
        const task = inquiry && taskById(inquiry.taskId);
        if (!inquiry || !bidder || !task) return null;
        return (
          <BidderTicket
            inquiry={inquiry}
            bidder={bidder}
            task={task}
            showTask={!byTask}
            onOpen={() => onOpen(inquiry.id)}
            onSchedule={() => onSchedule(inquiry.id)}
          />
        );
      }}
    />
  );
}
