import type { PauseRequest } from "@acorn/shared/plan-runner/types";
import type { DomNode } from "../types";

export function shortLabel(expectedLabel: string | null | undefined, action: string): string {
  const label = (expectedLabel || "").trim();
  if (!label) return action;
  return label.length > 36 ? `${label.slice(0, 33)}…` : label;
}

/**
 * Unattended pause policy for FAB pipeline:
 * - errors → always skip
 * - planned pause → continue so autofill can run when a value is present
 */
export async function autoPauseDecision(request: PauseRequest) {
  if (request.kind === "error") return "skip" as const;
  return "continue" as const;
}

export function countDomNodes(node: DomNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countDomNodes(child), 0);
}
