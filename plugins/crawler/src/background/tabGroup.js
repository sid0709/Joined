/* global chrome */

export const TAB_GROUP_BY_ROUTINE = Object.freeze({
  hiringcafe: Object.freeze({ title: "HiringCafe", color: "blue" }),
  builtin: Object.freeze({ title: "Built In", color: "pink" }),
  jobright: Object.freeze({ title: "JobRight", color: "green" }),
});

export function tabGroupSpec(routineId) {
  return TAB_GROUP_BY_ROUTINE[routineId] || { title: String(routineId || "Crawl"), color: "grey" };
}

/**
 * Put the bound tab in a named Chrome tab group for this routine, in that window.
 * The group is temporary: `ungroupBoundTab` removes the tab from it when the
 * run ends (stop, finish, block, or tab close). We do not leave the label up.
 */
export async function groupBoundTab(tab, routineId, io = chrome) {
  const spec = tabGroupSpec(routineId);
  const tabId = tab?.id;
  const windowId = tab?.windowId;
  if (!Number.isFinite(tabId) || typeof io.tabs?.group !== "function") {
    return null;
  }
  let groupId = null;
  if (typeof io.tabGroups?.query === "function" && Number.isFinite(windowId)) {
    const existing = await io.tabGroups.query({ windowId, title: spec.title }).catch(() => []);
    groupId = existing?.[0]?.id ?? null;
  }
  if (Number.isFinite(groupId)) {
    await io.tabs.group({ tabIds: [tabId], groupId });
  } else {
    const created = await io.tabs.group({
      tabIds: [tabId],
      createProperties: Number.isFinite(windowId) ? { windowId } : undefined,
    });
    groupId = created;
  }
  if (Number.isFinite(groupId) && typeof io.tabGroups?.update === "function") {
    await io.tabGroups.update(groupId, {
      title: spec.title,
      color: spec.color,
      collapsed: false,
    });
  }
  return groupId;
}

/** Take the crawl tab out of its named group so the label does not linger. */
export async function ungroupBoundTab(tabId, io = chrome) {
  const id = Number(tabId);
  if (!Number.isFinite(id) || typeof io.tabs?.ungroup !== "function") {
    return { ungrouped: false };
  }
  await io.tabs.ungroup(id).catch(() => {});
  return { ungrouped: true };
}
