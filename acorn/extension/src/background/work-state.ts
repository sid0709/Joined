/** Tabs with an in-flight FAB pipeline (parallel across tabs; one per tab). */
export const pipelineRunningTabIds = new Set<number>();
export const customGenerateTabIds = new Set<number>();
export const jobGenerateJobIds = new Set<string>();

export const KEEP_ALIVE_ALARM = "acorn-socket-keep-alive";
export const WORK_KEEP_ALIVE_ALARM = "acorn-work-keep-alive";

export function anyTabWorking(): boolean {
  return (
    pipelineRunningTabIds.size > 0 || customGenerateTabIds.size > 0 || jobGenerateJobIds.size > 0
  );
}

export function syncWorkKeepAlive(): void {
  if (anyTabWorking()) {
    chrome.alarms.create(WORK_KEEP_ALIVE_ALARM, { periodInMinutes: 0.5 });
    return;
  }
  void chrome.alarms.clear(WORK_KEEP_ALIVE_ALARM);
}
