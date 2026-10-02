import { resolveElementByNodeId } from "./element-resolver";

export interface ActionStep {
  type: "focus" | "click" | "type" | "wait" | "keydown" | "keyup";
  text?: string;
  ms?: number;
  key?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dispatchKey(el: HTMLElement, type: "keydown" | "keyup", key: string): void {
  const event = new KeyboardEvent(type, {
    key,
    code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(event);
}

async function typeText(el: HTMLElement, text: string): Promise<void> {
  el.focus();

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) {
      setter.call(el, text);
    } else {
      el.value = text;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    try {
      el.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }),
      );
    } catch {
      // InputEvent unsupported in some contexts
    }
    const jq = (
      el.ownerDocument.defaultView as unknown as {
        jQuery?: (sel: string | Element) => {
          val: (v: string) => { trigger: (e: string) => void };
        };
      }
    )?.jQuery;
    if (jq) {
      const chain = el.id ? jq(`#${el.id}`).val(text) : jq(el).val(text);
      chain.trigger("input");
      chain.trigger("change");
    }
    return;
  }

  if (el.isContentEditable) {
    el.textContent = text;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
    return;
  }

  for (const char of text) {
    dispatchKey(el, "keydown", char);
    el.dispatchEvent(
      new InputEvent("beforeinput", { bubbles: true, data: char, inputType: "insertText" }),
    );
    if (el.isContentEditable) {
      el.textContent = (el.textContent ?? "") + char;
    }
    dispatchKey(el, "keyup", char);
  }
}

export async function executeActions(nodeId: number, steps: ActionStep[]): Promise<void> {
  const el = resolveElementByNodeId(nodeId);
  if (!el) throw new Error("Element not found in DOM");

  const target = el as HTMLElement;

  for (const step of steps) {
    switch (step.type) {
      case "focus":
        target.focus();
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        break;
      case "click":
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        target.click();
        break;
      case "type":
        if (!step.text) throw new Error("Type action requires text");
        await typeText(target, step.text);
        break;
      case "wait":
        await sleep(step.ms ?? 1000);
        break;
      case "keydown":
        if (!step.key) throw new Error("Keydown action requires key");
        target.focus();
        dispatchKey(target, "keydown", step.key);
        break;
      case "keyup":
        if (!step.key) throw new Error("Keyup action requires key");
        target.focus();
        dispatchKey(target, "keyup", step.key);
        break;
      default:
        throw new Error(`Unknown action: ${(step as ActionStep).type}`);
    }
  }
}

export function getElementContent(nodeId: number, contentType: "innerHTML" | "innerText"): string {
  const el = resolveElementByNodeId(nodeId);
  if (!el) throw new Error("Element not found in DOM");
  // "innerHTML" here means the element's own markup (outerHTML), not its children only.
  return contentType === "innerHTML"
    ? el.outerHTML
    : ((el as HTMLElement).innerText ?? el.textContent ?? "");
}
