import { listDeclaredFields } from "./declaredFields.js";

/** Progress / stats widgets the Run panel can render. A routine opts into each one. */
export const RUN_COMPONENT = Object.freeze({
  STEPPER: "stepper",
  PACE: "pace",
  FIELD_GROUPS: "fieldGroups",
  RESULTS: "results",
});

export const RUN_STAT = Object.freeze({
  JOBS_PER_SECOND: "jobsPerSecond",
  CONCURRENCY: "concurrency",
  CURSOR: "cursor",
  BLOCKS: "blocks",
  OUTCOMES: "outcomes",
  QUEUE: "queue",
  RECENT_JOBS: "recentJobs",
  HEARTS: "hearts",
});

export const RUN_SETTING = Object.freeze({
  CONCURRENCY: "concurrency",
  JOBS_PER_SECOND: "jobsPerSecond",
  FAST_MODE: "fastMode",
});

const COMPONENT_VALUES = new Set(Object.values(RUN_COMPONENT));
const STAT_VALUES = new Set(Object.values(RUN_STAT));
const SETTING_VALUES = new Set(Object.values(RUN_SETTING));

export function fieldGroup(id, label, fields) {
  return Object.freeze({
    id: String(id),
    label: String(label),
    fields: Object.freeze([...(fields ?? [])].map(String)),
  });
}

function uniqueKnown(values, allowed, label) {
  const seen = new Set();
  const out = [];
  const problems = [];
  for (const value of values ?? []) {
    if (!allowed.has(value)) {
      problems.push(`${label} "${value}" is unknown`);
      continue;
    }
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return { values: Object.freeze(out), problems };
}

/**
 * What the Run panel shows for a routine. The panel renders only these groups,
 * components, stats, and settings — never a hardcoded field list.
 */
export function defineRunView({
  groups = [],
  components = [RUN_COMPONENT.STEPPER, RUN_COMPONENT.FIELD_GROUPS, RUN_COMPONENT.RESULTS],
  stats = [RUN_STAT.OUTCOMES, RUN_STAT.QUEUE, RUN_STAT.RECENT_JOBS],
  settings = [],
} = {}) {
  const problems = [];
  const nextGroups = [];
  const seenGroupIds = new Set();
  if (!Array.isArray(groups)) problems.push("runView.groups must be a list");
  else {
    groups.forEach((group, index) => {
      if (!group || typeof group !== "object") {
        problems.push(`runView group ${index + 1} must be an object`);
        return;
      }
      const id = String(group.id || "").trim();
      const label = String(group.label || "").trim();
      const fields = Array.isArray(group.fields) ? group.fields.map(String) : [];
      if (!id) problems.push(`runView group ${index + 1} needs an id`);
      if (!label) problems.push(`runView group "${id || index + 1}" needs a label`);
      if (!fields.length) problems.push(`runView group "${id || index + 1}" needs fields`);
      if (id && seenGroupIds.has(id)) problems.push(`runView group "${id}" is duplicated`);
      if (id) seenGroupIds.add(id);
      if (id && label && fields.length) nextGroups.push(fieldGroup(id, label, fields));
    });
  }
  const nextComponents = uniqueKnown(components, COMPONENT_VALUES, "runView component");
  const nextStats = uniqueKnown(stats, STAT_VALUES, "runView stat");
  const nextSettings = uniqueKnown(settings, SETTING_VALUES, "runView setting");
  problems.push(...nextComponents.problems, ...nextStats.problems, ...nextSettings.problems);
  if (problems.length) {
    throw new Error(`Invalid run view: ${problems.join("; ")}.`);
  }
  return Object.freeze({
    groups: Object.freeze(nextGroups),
    components: nextComponents.values,
    stats: nextStats.values,
    settings: nextSettings.values,
  });
}

export function defaultRunView(routine) {
  const fields = listDeclaredFields(routine).map((field) => field.key);
  return defineRunView({
    groups: fields.length ? [fieldGroup("fields", "Fields", fields)] : [],
    components: [RUN_COMPONENT.STEPPER, RUN_COMPONENT.FIELD_GROUPS, RUN_COMPONENT.RESULTS],
    stats: [RUN_STAT.OUTCOMES, RUN_STAT.QUEUE, RUN_STAT.RECENT_JOBS],
    settings: [],
  });
}

export function runViewProblems(view, declaredKeys = []) {
  if (view == null) return [];
  if (typeof view !== "object") return ["runView must be an object"];
  try {
    const normalized = defineRunView(view);
    const known = new Set(declaredKeys);
    const problems = [];
    for (const group of normalized.groups) {
      for (const key of group.fields) {
        if (known.size && !known.has(key)) {
          problems.push(`runView group "${group.id}" field "${key}" is not declared`);
        }
      }
    }
    return problems;
  } catch (error) {
    return [error.message.replace(/^Invalid run view: /, "").replace(/\.$/, "")];
  }
}

export function listRunComponents(routine) {
  return [...(routine?.runView?.components ?? defaultRunView(routine).components)];
}

export function listRunStats(routine) {
  return [...(routine?.runView?.stats ?? defaultRunView(routine).stats)];
}

export function listRunSettings(routine) {
  return [...(routine?.runView?.settings ?? defaultRunView(routine).settings)];
}

export function listFieldGroups(routine) {
  const view = routine?.runView;
  if (Array.isArray(view?.groups) && view.groups.length) return view.groups;
  return defaultRunView(routine).groups;
}

export function hasRunComponent(routine, id) {
  return listRunComponents(routine).includes(id);
}

export function hasRunStat(routine, id) {
  return listRunStats(routine).includes(id);
}

export function hasRunSetting(routine, id) {
  return listRunSettings(routine).includes(id);
}
