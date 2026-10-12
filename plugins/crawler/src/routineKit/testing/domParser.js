import { parseHTML } from "linkedom";

/** Tests run in bun, which has no DOMParser. Linkedom stands in. */
export function installDomParser() {
  if (typeof globalThis.DOMParser === "function") return;
  globalThis.DOMParser = function DOMParser() {};
  globalThis.DOMParser.prototype.parseFromString = function parseFromString(markup) {
    return parseHTML(String(markup ?? "")).document;
  };
}

installDomParser();
