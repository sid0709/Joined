import { findLowestCommonAncestor } from "../elementFinder";
import { isVisible } from "../domUtils";

export function handleExtractMainContent(sendResponse) {
  // Determine minimal container (LCA) that contains all visible interactables
  const allInteractive = Array.from(
    document.querySelectorAll('input:not([type="hidden"]),select,textarea,button,[role="button"]'),
  ).filter(isVisible);
  let container = allInteractive[0] || document.body;
  if (allInteractive.length > 1) {
    container = findLowestCommonAncestor(allInteractive) || container;
  }
  const mainContent = container.innerText;
  sendResponse && sendResponse({ mainContent });
}

export function handleFindInteractableElements(sendResponse) {
  const elements = Array.from(document.querySelectorAll("input, select, textarea, button"));
  const interactableElements = elements.map((element) => ({
    tagName: element.tagName,
    type: element.type,
    name: element.name,
    id: element.id,
    placeholder: element.placeholder,
    ariaLabel: element.getAttribute("aria-label"),
  }));
  sendResponse && sendResponse({ interactableElements });
}
