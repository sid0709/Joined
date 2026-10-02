import type { ActionPlan, PlanAction } from "./types";

export function collectForbiddenIndexes(plan: ActionPlan): Set<number> {
  const indexes = new Set<number>();

  const addFrom = (action: PlanAction) => {
    if (action.element_index != null) indexes.add(action.element_index);
    if (action.element_indexes?.length) {
      for (const id of action.element_indexes) indexes.add(id);
    }
  };

  for (const action of plan.forbidden_actions ?? []) addFrom(action);
  for (const action of plan.actions ?? []) {
    if (action.action === "forbidden") addFrom(action);
  }

  return indexes;
}

export function targetsForbiddenIndex(action: PlanAction, forbidden: Set<number>): boolean {
  if (action.element_index != null && forbidden.has(action.element_index)) {
    return true;
  }
  if (action.element_indexes?.some((id) => forbidden.has(id))) {
    return true;
  }
  return false;
}
