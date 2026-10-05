import { ROUTINE_EXEC_ACTION } from "../routineKit/protocol.js";

import { handleJobBidMessage } from "./jobBidStore.js";
import { actionsToForward, forwardToContentScript } from "./messages/forwardToContentScript.js";
import { handleOpenTabs } from "./messages/openTabs.js";
import { handleReadLocalFile } from "./messages/readLocalFile.js";
import { handleRoutineExec } from "./messages/routineExec.js";
import {
  handleScrapeQueueClear,
  handleScrapeQueueEnqueue,
  handleScrapeQueueGetState,
  handleScrapeQueueRecordOutcome,
} from "./scrapeQueueWorker.js";

// Messages coming from content scripts that should be relayed to the extension UI
// Listen for messages from the UI and forward them to the content script or to backend
export function routeMessage(message, sender, sendResponse) {
  if (message?.action === ROUTINE_EXEC_ACTION) {
    handleRoutineExec(message, sendResponse);
    return true;
  }

  if (message?.action === "scrapeQueue:enqueue") {
    handleScrapeQueueEnqueue(message, sendResponse);
    return true;
  }

  if (message?.action === "scrapeQueue:clear") {
    handleScrapeQueueClear(message, sendResponse);
    return true;
  }

  if (message?.action === "scrapeQueue:getState") {
    handleScrapeQueueGetState(message, sendResponse);
    return true;
  }

  if (message?.action === "scrapeQueue:recordOutcome") {
    handleScrapeQueueRecordOutcome(message, sendResponse);
    return true;
  }

  if (message?.action === "readLocalFile") {
    handleReadLocalFile(message, sendResponse);

    return true;
  }

  if (message.action === "open-tabs") {
    handleOpenTabs(message);
    return;
  }

  if (handleJobBidMessage(message)) {
    return;
  }

  if (actionsToForward.includes(message.action)) {
    forwardToContentScript(message);
    return;
  }
}
