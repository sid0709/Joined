/** Escape a value for use as a CSS identifier or unquoted attribute value. */
export function cssEscape(value) {
  const text = String(value ?? "");
  if (typeof globalThis.CSS?.escape === "function") return globalThis.CSS.escape(text);
  return escapeCssIdent(text);
}

function escapeCssIdent(text) {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const ch = text[i];
    if (code === 0) {
      out += "\uFFFD";
      continue;
    }
    const firstDigit = i === 0 && code >= 48 && code <= 57;
    const hyphenDigit = i === 1 && code >= 48 && code <= 57 && text[0] === "-";
    const control = (code >= 1 && code <= 31) || code === 127;
    if (control || firstDigit || hyphenDigit) {
      out += `\\${code.toString(16)} `;
      continue;
    }
    const ident =
      code >= 128 ||
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      ch === "-" ||
      ch === "_";
    out += ident ? ch : `\\${ch}`;
  }
  return out;
}

export function jobSaveSelector(id) {
  return `my-item[entity-type="job"][entity-id=${cssEscape(id)}]`;
}
