"use client";

import { createContext, useContext, useState } from "react";

import type {
  BidderAssignment,
  BidderConversation,
  BidderLinkStatus,
  BidderTask,
} from "@/src/shared/types/bidder-workflow";

import {
  BIDDER_ASSIGNMENTS,
  BIDDER_CONVERSATIONS,
  BIDDER_TASKS,
} from "@/src/shared/data/bidderWorkflowData";

interface BidderWorkflowValue {
  tasks: BidderTask[];
  assignments: BidderAssignment[];
  conversations: BidderConversation[];
  expressInterest: (taskId: string) => void;
  sendMessage: (conversationId: string, body: string) => void;
  updateLink: (assignmentId: string, linkId: string, status: BidderLinkStatus) => void;
}

const BidderWorkflowContext = createContext<BidderWorkflowValue | undefined>(undefined);

export function BidderWorkflowProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState(BIDDER_TASKS);
  const [assignments, setAssignments] = useState(BIDDER_ASSIGNMENTS);
  const [conversations, setConversations] = useState(BIDDER_CONVERSATIONS);

  const expressInterest = (taskId: string) =>
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId && task.status === "Open" ? { ...task, status: "Interest sent" } : task,
      ),
    );
  const sendMessage = (conversationId: string, body: string) => {
    if (!body.trim()) return;
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              unread: 0,
              messages: [
                ...conversation.messages,
                {
                  id: `message-${Date.now()}`,
                  sender: "bidder",
                  body: body.trim(),
                  time: "Just now",
                },
              ],
            }
          : conversation,
      ),
    );
  };
  const updateLink = (assignmentId: string, linkId: string, status: BidderLinkStatus) =>
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.id === assignmentId
          ? {
              ...assignment,
              links: assignment.links.map((link) =>
                link.id === linkId ? { ...link, status } : link,
              ),
            }
          : assignment,
      ),
    );

  return (
    <BidderWorkflowContext.Provider
      value={{ tasks, assignments, conversations, expressInterest, sendMessage, updateLink }}
    >
      {children}
    </BidderWorkflowContext.Provider>
  );
}

export function useBidderWorkflow() {
  const value = useContext(BidderWorkflowContext);
  if (!value) throw new Error("useBidderWorkflow must be used within BidderWorkflowProvider.");
  return value;
}
