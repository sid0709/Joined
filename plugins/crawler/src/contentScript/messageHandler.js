import { clearHighlights } from "./highlighter";
import {
  handleExecuteAction,
  handleExecuteActionsParallel,
  handleExecuteActionsSequence,
} from "./messages/executeActions";
import { handleHighlightByPattern, handleHighlightInteractables } from "./messages/highlight";
import { handleExtractMainContent, handleFindInteractableElements } from "./messages/pageQueries";

export const messageHandler = (request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case "EXTRACT_MAIN_CONTENT": {
          handleExtractMainContent(sendResponse);
          break;
        }
        case "FIND_INTERACTABLE_ELEMENTS": {
          handleFindInteractableElements(sendResponse);
          break;
        }
        case "highlightByPattern": {
          handleHighlightByPattern(request);
          break;
        }
        case "clearHighlight": {
          clearHighlights();
          break;
        }

        case "executeAction": {
          await handleExecuteAction(request);
          break;
        }

        case "executeActionsSequence": {
          await handleExecuteActionsSequence(request);
          break;
        }

        case "executeActionsParallel": {
          await handleExecuteActionsParallel(request);
          break;
        }

        case "highlightInteractables": {
          handleHighlightInteractables(request);
          break;
        }

        // (The clearHighlights function remains the same as the previous version)
        default:
          break;
      }
    } catch (e) {
      console.error("messageHandler error:", e);
      // Best-effort error response for the two async sendResponse cases
      if (
        typeof sendResponse === "function" &&
        (request.action === "EXTRACT_MAIN_CONTENT" ||
          request.action === "FIND_INTERACTABLE_ELEMENTS")
      ) {
        try {
          sendResponse({ error: String((e && e.message) || e) });
        } catch (e) {
          console.error("Failed to send error response:", e);
        }
      }
    }
  })();
  // Keep the channel open only for actions that use sendResponse
  return (
    request.action === "EXTRACT_MAIN_CONTENT" || request.action === "FIND_INTERACTABLE_ELEMENTS"
  );
};
