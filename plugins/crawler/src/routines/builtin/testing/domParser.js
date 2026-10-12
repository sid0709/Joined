import { parseHTML } from "linkedom";

/** Tests run in bun, which has no DOMParser. Linkedom stands in. */
export function installDomParser() {
  if (typeof globalThis.DOMParser === "function") return;
  globalThis.DOMParser = class DOMParser {
    parseFromString(markup) {
      return parseHTML(String(markup ?? "")).document;
    }
  };
}

installDomParser();
