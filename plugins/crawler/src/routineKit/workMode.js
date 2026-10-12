const WORK_MODE = Object.freeze({
  REMOTE: "remote",
  HYBRID: "hybrid",
  ONSITE: "onsite",
});

/** Map a board's workplace label to remote | hybrid | onsite. */
export function workModeFrom(value, isRemote) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (isRemote === true || /\bremote\b/.test(text)) return WORK_MODE.REMOTE;
  if (/\bhybrid\b/.test(text)) return WORK_MODE.HYBRID;
  if (/\bon[-\s]?site\b|\bin-office\b|\boffice\b/.test(text)) return WORK_MODE.ONSITE;
  return String(value ?? "").trim();
}
