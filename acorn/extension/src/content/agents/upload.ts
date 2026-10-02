import type { RuntimeAttachedFile } from "../../types";
import { resolveElementByNodeId } from "../element-resolver";
import { pageMentionsFilename, rememberUploadedFile } from "./upload-registry";
import { waitForUploadComplete, waitMs } from "./wait";

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildFile(file: RuntimeAttachedFile): File {
  const bytes = base64ToUint8Array(file.base64);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: file.mimeType || "application/octet-stream" });
  return new File([blob], file.name, {
    type: file.mimeType || "application/octet-stream",
  });
}

function applyFiles(input: HTMLInputElement, fileObj: File): string[] {
  const dt = new DataTransfer();
  dt.items.add(fileObj);
  try {
    input.files = dt.files;
  } catch {
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
    desc?.set?.call(input, dt.files);
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return Array.from(input.files ?? []).map((f) => f.name);
}

function listFileInputs(doc: Document = document): HTMLInputElement[] {
  return Array.from(doc.querySelectorAll('input[type="file"]')).filter(
    (node): node is HTMLInputElement => node instanceof HTMLInputElement && node.isConnected,
  );
}

/** Only treat another file input as a remount of THIS control — never a different acorn-id field. */
function findSuccessorInput(
  original: HTMLInputElement,
  target: HTMLInputElement,
  acornId: string | null,
  doc: Document,
): HTMLInputElement | null {
  const connected = listFileInputs(doc);
  const sameAcorn = acornId
    ? connected.find((node) => node.getAttribute("data-acorn-id") === acornId)
    : null;
  if (sameAcorn) return sameAcorn;

  const form = target.form || original.form;
  const pool = (form ? connected.filter((node) => node.form === form) : connected).filter(
    (node) => {
      const id = node.getAttribute("data-acorn-id");
      // A different stamped acorn id is a different field (e.g. cover letter vs resume).
      if (id && acornId && id !== acornId) return false;
      return true;
    },
  );

  const unstamped = pool.filter((node) => !node.getAttribute("data-acorn-id"));
  if (original.name) {
    const byName = unstamped.find((node) => node.name === original.name);
    if (byName) return byName;
  }

  return (
    unstamped.find((node) => node !== target) ||
    pool.find((node) => node !== target && !node.getAttribute("data-acorn-id")) ||
    null
  );
}

async function waitForUploadEvidence(
  doc: Document,
  fileName: string,
  acornId: string | null,
  maxMs = 4000,
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (pageMentionsFilename(doc, fileName)) return true;

    if (acornId) {
      const el = resolveElementByNodeId(Number(acornId));
      if (el instanceof HTMLInputElement && el.type === "file" && (el.files?.length ?? 0) > 0) {
        return true;
      }
    }

    const withFile = listFileInputs(doc).find((node) =>
      Array.from(node.files ?? []).some((f) => f.name === fileName),
    );
    if (withFile) {
      if (acornId) withFile.setAttribute("data-acorn-id", acornId);
      return true;
    }

    await waitMs(150);
  }
  return false;
}

async function persistUploadAcrossRemount(
  original: HTMLInputElement,
  fileObj: File,
  acornId: string | null,
): Promise<{ names: string[]; input: HTMLInputElement }> {
  const doc = original.ownerDocument || document;
  let target = original;
  const names = applyFiles(target, fileObj);
  const fileName = names[0] || fileObj.name;

  for (let attempt = 0; attempt < 6; attempt++) {
    await waitMs(150);

    if (target.isConnected && (target.files?.length ?? 0) > 0) {
      if (acornId) target.setAttribute("data-acorn-id", acornId);
      rememberUploadedFile(acornId, fileName);
      return { names: Array.from(target.files ?? []).map((f) => f.name), input: target };
    }

    if (pageMentionsFilename(doc, fileName)) {
      rememberUploadedFile(acornId, fileName);
      return { names: [fileName], input: target };
    }

    const successor = findSuccessorInput(original, target, acornId, doc);

    if (successor && (successor.files?.length ?? 0) > 0) {
      if (acornId) successor.setAttribute("data-acorn-id", acornId);
      rememberUploadedFile(acornId, fileName);
      return {
        names: Array.from(successor.files ?? []).map((f) => f.name),
        input: successor,
      };
    }

    if (successor && successor !== target) {
      // Replacement of THIS control only — re-apply once onto unstamped/same-id successor.
      if (acornId) successor.setAttribute("data-acorn-id", acornId);
      target = successor;
      applyFiles(target, fileObj);
      continue;
    }

    // No safe successor (often the only remaining input is a different field). Wait for UI evidence.
    break;
  }

  const evidenced = await waitForUploadEvidence(doc, fileName, acornId, 4000);

  if (evidenced) {
    rememberUploadedFile(acornId, fileName);
    const resolved = acornId ? resolveElementByNodeId(Number(acornId)) : null;
    const input =
      resolved instanceof HTMLInputElement
        ? resolved
        : listFileInputs(doc).find((n) =>
            Array.from(n.files ?? []).some((f) => f.name === fileName),
          ) || target;
    return { names: [fileName], input };
  }

  throw new Error("Upload did not persist after the page remounted the file input");
}

export async function uploadFileToElement(el: Element, file: RuntimeAttachedFile): Promise<string> {
  if (!(el instanceof HTMLInputElement) || el.type !== "file") {
    throw new Error(`Upload target is not a file input (got <${el.tagName.toLowerCase()}>)`);
  }

  const acornId = el.getAttribute("data-acorn-id");
  const fileObj = buildFile(file);
  const { names } = await persistUploadAcrossRemount(el, fileObj, acornId);

  if (!names.length) {
    throw new Error("File was not attached to input");
  }
  rememberUploadedFile(acornId, names[0]);
  await waitForUploadComplete(el.ownerDocument || document);
  return names.join(", ");
}
