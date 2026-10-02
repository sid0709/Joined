/** Split / format DOM trees for AI Analyze prompts. */

export interface DomTreeNode {
  nodeId: number;
  tag: string;
  id?: string;
  classes?: string[];
  attrs?: Record<string, string>;
  text?: string;
  children: DomTreeNode[];
}

export interface PureNode {
  tag: string;
  id: number;
  text?: string;
  /** Useful form/control attrs e.g. type=file name=email aria-required=true */
  detail?: string;
  children: PureNode[];
}

export interface MetaNode {
  id: number;
  domId?: string;
  classes?: string[];
  attrs?: Record<string, string>;
  children: MetaNode[];
}

/** Native form tags keep emitting `domId` even with no other control attrs. */
const DETAIL_TAGS = new Set([
  "a",
  "button",
  "fieldset",
  "form",
  "input",
  "label",
  "li",
  "option",
  "select",
  "textarea",
]);

const DETAIL_ATTR_KEYS = [
  "for",
  "type",
  "role",
  "name",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-required",
  "aria-invalid",
  "aria-checked",
  "autocomplete",
  "placeholder",
  "value",
  "data-automation-id",
  "data-fkit-id",
  "selected",
  "checked",
] as const;

export function splitDomTree(root: DomTreeNode): { pure: PureNode; meta: MetaNode } {
  return {
    pure: toPureNode(root),
    meta: toMetaNode(root),
  };
}

function toPureNode(node: DomTreeNode): PureNode {
  const pure: PureNode = {
    tag: node.tag,
    id: node.nodeId,
    children: node.children.map(toPureNode),
  };
  if (node.text) pure.text = node.text;
  const detail = buildDetail(node);
  if (detail) pure.detail = detail;
  return pure;
}

/**
 * Control detail for ANY tag that carries it, not just native form tags: a modern
 * combobox is `<div role="combobox" aria-expanded>`, and that detail used to reach
 * the planner only through the separate Meta Tree.
 *
 * `class` rides here too. Hosts name their widget components in class tokens, and
 * for a custom control that is frequently the ONLY signal of what the node is: a
 * yes/no toggle button and a plain button are both `<button>"Yes"`, and a résumé
 * drop zone and the résumé field are both `<input type=file>`. That signal used to
 * reach the planner through the Meta Tree; folding it into `detail` keeps the
 * single-tree / single-request shape without blinding the planner. No token is
 * interpreted here — the tree reports, the model decides.
 */
function buildDetail(node: DomTreeNode): string | null {
  const attrParts: string[] = [];
  for (const key of DETAIL_ATTR_KEYS) {
    const value = node.attrs?.[key];
    if (value) attrParts.push(`${key}=${formatDetailValue(value)}`);
  }
  const classValue = node.classes?.length ? node.classes.join(" ") : "";
  if (classValue) attrParts.push(`class=${formatDetailValue(classValue)}`);
  if (!attrParts.length && !(DETAIL_TAGS.has(node.tag) && node.id)) return null;
  const parts = node.id ? [`domId=${node.id}`, ...attrParts] : attrParts;
  return parts.length ? parts.join(" ") : null;
}

function formatDetailValue(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

function toMetaNode(node: DomTreeNode): MetaNode {
  const meta: MetaNode = {
    id: node.nodeId,
    children: node.children.map(toMetaNode),
  };
  if (node.id) meta.domId = node.id;
  if (node.classes?.length) meta.classes = node.classes;
  if (node.attrs && Object.keys(node.attrs).length > 0) meta.attrs = node.attrs;
  return meta;
}

function formatPureNodeLine(pure: PureNode): string {
  const detailPart = pure.detail ? ` ${pure.detail}` : "";
  const textPart = pure.text ? ` "${pure.text}"` : "";
  return `${pure.tag}[${pure.id}]${detailPart}${textPart}`;
}

export function* iteratePureTreeLines(pure: PureNode, depth = 0): Generator<string> {
  yield `${"  ".repeat(depth)}${formatPureNodeLine(pure)}`;
  for (const child of pure.children) {
    yield* iteratePureTreeLines(child, depth + 1);
  }
}

export function formatPureTreePreview(pure: PureNode, depth = 0): string {
  const indent = "  ".repeat(depth);
  const lines = [`${indent}${formatPureNodeLine(pure)}`];
  for (const child of pure.children) {
    lines.push(formatPureTreePreview(child, depth + 1));
  }
  return lines.join("\n");
}

function buildPureIndex(pure: PureNode, map = new Map<number, PureNode>()): Map<number, PureNode> {
  map.set(pure.id, pure);
  for (const child of pure.children) buildPureIndex(child, map);
  return map;
}

function formatMetaNodeLine(
  meta: MetaNode,
  pureById: Map<number, PureNode>,
  depth: number,
): string {
  const indent = "  ".repeat(depth);
  const pure = pureById.get(meta.id);
  const tag = pure?.tag ?? "?";

  const parts: string[] = [`[${meta.id}]`, `<${tag}>`];
  if (meta.domId) parts.push(`#${meta.domId}`);
  if (meta.classes?.length) parts.push(`.${meta.classes.join(".")}`);
  if (meta.attrs) {
    const attrStr = Object.entries(meta.attrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ");
    if (attrStr) parts.push(attrStr);
  }

  return `${indent}${parts.join(" ")}`;
}

function* iterateMetaLines(
  meta: MetaNode,
  pureById: Map<number, PureNode>,
  depth: number,
): Generator<string> {
  yield formatMetaNodeLine(meta, pureById, depth);
  for (const child of meta.children) {
    yield* iterateMetaLines(child, pureById, depth + 1);
  }
}

export function iterateMetaTreeLines(meta: MetaNode, pure: PureNode): Generator<string> {
  return iterateMetaLines(meta, buildPureIndex(pure), 0);
}

function formatMetaLine(meta: MetaNode, pureById: Map<number, PureNode>, depth: number): string {
  const lines = [formatMetaNodeLine(meta, pureById, depth)];
  for (const child of meta.children) {
    lines.push(formatMetaLine(child, pureById, depth + 1));
  }
  return lines.join("\n");
}

export function formatMetaTreePreview(meta: MetaNode, pure: PureNode): string {
  const pureById = buildPureIndex(pure);
  return formatMetaLine(meta, pureById, 0);
}

/** Same formatted trees Fill sends to AI Analyze. */
export function formatAnalyzeTrees(root: DomTreeNode): {
  pure: PureNode;
  meta: MetaNode;
  pureTree: string;
  metaTree: string;
} {
  const split = splitDomTree(root);
  return {
    pure: split.pure,
    meta: split.meta,
    pureTree: formatPureTreePreview(split.pure),
    metaTree: formatMetaTreePreview(split.meta, split.pure),
  };
}

/** Collect up to `limit` lines without materializing the rest of the iterator. */
export function collectLines(
  iter: Iterable<string>,
  limit: number,
): { lines: string[]; hasMore: boolean } {
  const lines: string[] = [];
  let hasMore = false;
  for (const line of iter) {
    if (lines.length >= limit) {
      hasMore = true;
      break;
    }
    lines.push(line);
  }
  return { lines, hasMore };
}
