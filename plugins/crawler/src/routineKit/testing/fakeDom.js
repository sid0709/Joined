/**
 * A stand-in for DOM elements in routine tests. `querySelectorAll` looks selectors up
 * exactly in `children`, so a test spells out what each selector matches.
 */
export function fakeElement({
  text = "",
  textContent = text,
  attrs = {},
  props = {},
  children = {},
} = {}) {
  return {
    innerText: text,
    textContent,
    outerHTML: `<fake>${text}</fake>`,
    ...props,
    getAttribute: (name) => attrs[name] ?? null,
    querySelectorAll: (selector) => children[selector] ?? [],
  };
}

export const fakeRoot = (children) => fakeElement({ children });
