import { attr, html, prop, rawText, text } from "../../routineKit/fields.js";

/** How the Inspector reads an element, with the routineKit builder each choice writes. */
export const READ_OPTIONS = [
  { value: "text", label: "Text", builder: "text" },
  { value: "textContent", label: "Raw text", builder: "rawText" },
  { value: "html", label: "HTML", builder: "html" },
  { value: "attr", label: "Attribute", builder: "attr", isNamed: true },
  { value: "prop", label: "Property", builder: "prop", isNamed: true },
];

export const TRANSFORM_OPTIONS = [
  { value: "", label: "None" },
  { value: "lines", label: "Lines → list" },
  { value: "trim", label: "Trim" },
  { value: "countedText", label: "Text + first number" },
  { value: "httpUrl", label: "Only http(s) URL" },
];

const BUILDERS = { text, rawText, html, attr, prop };

/** The Inspector's form before anything is typed. */
export const EMPTY_DRAFT = Object.freeze({
  selector: "",
  read: "text",
  name: "",
  nth: 0,
  inner: "",
  all: false,
  transform: "",
});

const readOption = (read) =>
  READ_OPTIONS.find((option) => option.value === read) ?? READ_OPTIONS[0];

/** True when the draft names everything its read needs (a selector, and a name for attr/prop). */
export function isDraftComplete(draft) {
  if (!draft.selector.trim()) return false;
  return !readOption(draft.read).isNamed || Boolean(draft.name.trim());
}

/** The field options a draft sets, leaving defaults out so the snippet stays short. */
function draftOptions(draft) {
  const options = {};
  if (draft.nth > 0) options.nth = draft.nth;
  if (draft.inner.trim()) options.inner = draft.inner.trim();
  if (draft.all) options.all = true;
  if (draft.transform) options.then = [draft.transform];
  return options;
}

function builderArgs(draft) {
  const option = readOption(draft.read);
  const args = [draft.selector.trim()];
  if (option.isNamed) args.push(draft.name.trim());
  return { option, args };
}

/** The routine field the draft describes. `wait` is how long to wait for the selector. */
export function draftToField(draft, wait = 0) {
  const { option, args } = builderArgs(draft);
  return BUILDERS[option.builder](...args, { ...draftOptions(draft), wait });
}

/** The draft as routine code, ready to paste into a routine's `fields`. */
export function draftToSnippet(draft) {
  const { option, args } = builderArgs(draft);
  const parts = args.map((arg) => JSON.stringify(arg));
  const options = Object.entries(draftOptions(draft)).map(
    ([key, value]) => `${key}: ${JSON.stringify(value)}`,
  );
  if (options.length) parts.push(`{ ${options.join(", ")} }`);
  return `${option.builder}(${parts.join(", ")})`;
}
