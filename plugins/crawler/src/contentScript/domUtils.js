export function isVisible(el) {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return (
    rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none"
  );
}

export function resolveInteractiveTargetForNode(node) {
  if (!node) return null;
  if (node.matches && node.matches('input,select,textarea,button,[role="button"]')) return node;
  if (node.tagName && node.tagName.toLowerCase() === "label") {
    const forId = node.getAttribute("for");
    if (forId) {
      const target = document.getElementById(forId);
      if (target) return target;
    }
    const inner = node.querySelector('input,select,textarea,button,[role="button"]');
    if (inner) return inner;
  }
  return null;
}
