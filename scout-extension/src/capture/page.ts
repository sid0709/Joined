export interface PageElement {
  readonly textContent: string | null;
  getAttribute(name: string): string | null;
  querySelector(selector: string): PageElement | null;
  querySelectorAll(selector: string): ArrayLike<PageElement>;
}

export interface PageRoot {
  querySelector(selector: string): PageElement | null;
  querySelectorAll(selector: string): ArrayLike<PageElement>;
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeMultiline(value: string): string {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function stripHtml(value: string): string {
  return normalizeMultiline(decodeHtmlEntities(value.replace(/<[^>]+>/g, " ")));
}

export function elementText(element: PageElement | null): string {
  if (!element) {
    return "";
  }
  return normalizeText(element.textContent ?? "");
}

export function elementMultiline(element: PageElement | null): string {
  if (!element) {
    return "";
  }
  return normalizeMultiline(element.textContent ?? "");
}

export function firstMatching(root: PageRoot, selectors: readonly string[]): PageElement | null {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element) {
      return element;
    }
  }
  return null;
}

export function firstText(root: PageRoot, selectors: readonly string[]): string {
  return elementText(firstMatching(root, selectors));
}

export function firstMultiline(root: PageRoot, selectors: readonly string[]): string {
  return elementMultiline(firstMatching(root, selectors));
}

export function firstAttribute(root: PageRoot, selectors: readonly string[], name: string): string {
  const element = firstMatching(root, selectors);
  return normalizeText(element?.getAttribute(name) ?? "");
}

export function resolvePageUrl(href: string, pageUrl: string): string {
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return href;
  }
}

export function firstHref(root: PageRoot, selectors: readonly string[], pageUrl: string): string {
  const href = firstAttribute(root, selectors, "href");
  if (!href) {
    return "";
  }
  return resolvePageUrl(href, pageUrl);
}
