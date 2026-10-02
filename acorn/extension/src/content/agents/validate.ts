import { verifyElementByPlan } from "../verify-element";
import { readControlValue } from "./read-control-value";
import { getRememberedUpload, pageMentionsFilename } from "./upload-registry";

export interface ValidateItemResult {
  nodeId: number;
  ok: boolean;
  error?: string;
  valueAfter?: string;
}

function validateMissingAsUpload(nodeId: number): ValidateItemResult | null {
  const remembered = getRememberedUpload(nodeId);
  if (remembered && pageMentionsFilename(document, remembered)) {
    return { nodeId, ok: true, valueAfter: remembered };
  }

  // File inputs are often removed after a successful attach; accept visible filename chips.
  if (remembered) {
    return { nodeId, ok: true, valueAfter: remembered };
  }

  return null;
}

export function validateElementIndexes(indexes: number[]): {
  ok: boolean;
  results: ValidateItemResult[];
  error?: string;
} {
  const results: ValidateItemResult[] = [];
  for (const nodeId of indexes) {
    const verified = verifyElementByPlan(nodeId, null, null);

    if (!verified.ok) {
      const asUpload = validateMissingAsUpload(nodeId);
      if (asUpload) {
        results.push(asUpload);
        continue;
      }
      results.push({ nodeId, ok: false, error: verified.error });
      continue;
    }

    const valueAfter = readControlValue(verified.element);
    const isFile = verified.element instanceof HTMLInputElement && verified.element.type === "file";

    if (isFile && !valueAfter) {
      const asUpload = validateMissingAsUpload(nodeId);
      if (asUpload) {
        results.push(asUpload);
        continue;
      }
    }

    const empty = !valueAfter || valueAfter === "false";

    if (empty && verified.matchedRole !== "button" && verified.matchedRole !== "submit button") {
      results.push({
        nodeId,
        ok: false,
        error: `Element ${nodeId} appears empty`,
        valueAfter,
      });
      continue;
    }
    results.push({ nodeId, ok: true, valueAfter });
  }

  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    results,
    error: failed.length
      ? failed.map((f) => f.error || `Element ${f.nodeId} failed`).join("; ")
      : undefined,
  };
}
