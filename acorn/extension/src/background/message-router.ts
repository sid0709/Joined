import { MSG } from "../types";
import {
  handleAuthSignIn,
  handleAuthSignOut,
  handleAuthStatus,
  handleReconnectSocket,
  handleSocketStatus,
} from "./messages/auth";
import {
  handleFocusCustomTab,
  handleForgetCustomTab,
  handleRememberCustomTab,
} from "./messages/custom-tabs";
import {
  handleStartCustomGenerate,
  handleStartCustomRecommend,
  handleStartJobWork,
} from "./messages/generate";
import { handleMatchOption } from "./messages/match-option";
import { handleFetchDom, handleStartPipeline } from "./messages/pipeline";
import { handleSelectionQa } from "./messages/selection-qa";
import type { RuntimeMessage, SendResponse } from "./messages/shared";
import {
  handleGetTabJob,
  handleListWorkerJobs,
  handleMarkJobApplied,
  handleOpenWorkerJob,
} from "./messages/worker-jobs";

/** Sends each sidebar/content message to its handler. Returns true to keep `sendResponse` open. */
export function routeMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: SendResponse,
) {
  if (message.type === MSG.SOCKET_STATUS) {
    handleSocketStatus(sendResponse);
    return true;
  }

  if (message.type === MSG.AUTH_STATUS) {
    handleAuthStatus(sendResponse);
    return true;
  }

  if (message.type === MSG.AUTH_SIGNIN) {
    handleAuthSignIn(message, sendResponse);
    return true;
  }

  if (message.type === MSG.AUTH_SIGNOUT) {
    handleAuthSignOut(sendResponse);
    return true;
  }

  if (message.type === MSG.LIST_WORKER_JOBS) {
    handleListWorkerJobs(sendResponse);
    return true;
  }

  if (message.type === MSG.OPEN_WORKER_JOB) {
    handleOpenWorkerJob(message, sender, sendResponse);
    return true;
  }

  if (message.type === MSG.MARK_JOB_APPLIED) {
    handleMarkJobApplied(message, sendResponse);
    return true;
  }

  if (message.type === MSG.GET_TAB_JOB) {
    handleGetTabJob(message, sender, sendResponse);
    return true;
  }

  if (message.type === MSG.SELECTION_QA) {
    handleSelectionQa(message, sender, sendResponse);
    return true;
  }

  if (message.type === MSG.REMEMBER_CUSTOM_TAB) {
    handleRememberCustomTab(message, sender, sendResponse);
    return true;
  }

  if (message.type === MSG.FORGET_CUSTOM_TAB) {
    handleForgetCustomTab(message, sender, sendResponse);
    return true;
  }

  if (message.type === MSG.FOCUS_CUSTOM_TAB) {
    handleFocusCustomTab(message, sender, sendResponse);
    return true;
  }

  if (message.type === MSG.START_CUSTOM_GENERATE) {
    handleStartCustomGenerate(message, sender, sendResponse);
    return true;
  }

  if (message.type === MSG.START_CUSTOM_RECOMMEND) {
    handleStartCustomRecommend(message, sender, sendResponse);
    return true;
  }

  if (message.type === MSG.START_JOB_GENERATE || message.type === MSG.START_JOB_RECOMMEND) {
    handleStartJobWork(message, sender, sendResponse);
    return true;
  }

  if (message.type === "acorn:reconnect-socket") {
    handleReconnectSocket(sendResponse);
    return true;
  }

  if (message.type === MSG.START_PIPELINE) {
    handleStartPipeline(message, sender, sendResponse);
    return true;
  }

  if (message.type === MSG.MATCH_OPTION) {
    handleMatchOption(message, sender, sendResponse);
    return true;
  }

  if (message.type === MSG.FETCH_DOM || message.type === MSG.FETCH_AND_EMIT_DOM) {
    handleFetchDom(message, sender, sendResponse);
    return true;
  }
}
