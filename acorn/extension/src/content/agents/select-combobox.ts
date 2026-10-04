import { resolveDropdownInteractionTarget } from "./enhanced-select";
import { fillNativeSelect } from "./native-select";
import { pointerActivate } from "./pointer-activate";
import { readControlValue } from "./read-control-value";
import { waitMs } from "./wait";
import { matchFromCandidates } from "./combobox/match";
import { normalize, optionSignature, optionText } from "./combobox/options-dom";
import {
  findLiveOption,
  openAndCollectOptions,
  waitForFilteredOptions,
} from "./combobox/options-wait";
import {
  dismissOpenOverlays,
  focusAndOpenCombobox,
  pasteQueryIntoOpenCombobox,
  resolveTypeableInput,
  typeQueryIntoOpenCombobox,
  typeaheadFilterWaitMs,
} from "./combobox/typing";

/** Typeahead lists are large; closed menus already show every choice. */
const CLOSED_LIST_MAX = 48;

/**
 * 1) Focus → collect initial candidates → local match → AI match on closed lists
 * 2) Typeahead: paste the full query, wait for the filtered list, then match
 */
export async function selectComboboxOption(
  el: Element,
  value: string,
  fieldHint?: string | null,
): Promise<string> {
  const requested = el as HTMLElement;
  if (requested instanceof HTMLSelectElement) {
    return fillNativeSelect(requested, value);
  }
  const html = resolveDropdownInteractionTarget(requested);
  if (html instanceof HTMLSelectElement) {
    return fillNativeSelect(html, value);
  }
  const doc = html.ownerDocument || document;
  const fromDom =
    html.getAttribute("aria-label") ||
    requested.getAttribute("aria-label") ||
    (html.id
      ? doc.querySelector(`label[for="${CSS.escape(html.id)}"]`)?.textContent?.trim()
      : null) ||
    (requested.id
      ? doc.querySelector(`label[for="${CSS.escape(requested.id)}"]`)?.textContent?.trim()
      : null) ||
    null;
  const fieldLabel =
    [fieldHint, fromDom]
      .map((part) =>
        String(part || "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .filter(
        (part, i, all) =>
          all.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === i,
      )
      .join(" ") || null;

  dismissOpenOverlays(doc, html);
  await waitMs(40);
  let options = await openAndCollectOptions(html, doc);

  const intendedInList = (list: HTMLElement[]) => {
    const want = normalize(value);
    return list.some((opt) => {
      const have = normalize(optionText(opt));
      return have === want || have.includes(want) || want.includes(have);
    });
  };

  const initialOptions = options;
  const closedList = initialOptions.length > 0 && initialOptions.length <= CLOSED_LIST_MAX;
  const allowInitialAi = closedList || intendedInList(initialOptions);
  let { match } = await matchFromCandidates(options, value, fieldLabel, null, allowInitialAi);

  // Typeahead: type the full query and wait for the list to change.
  // Closed menus already show every candidate — typing filters them away.
  const typeable = resolveTypeableInput(html);
  if (!match && !closedList && typeable && value.trim().length >= 2) {
    const query = value.trim();
    const priorSig = optionSignature(initialOptions);
    const filterWait = typeaheadFilterWaitMs(doc);

    await focusAndOpenCombobox(html);
    await pasteQueryIntoOpenCombobox(html, query);
    let filtered = await waitForFilteredOptions(html, doc, priorSig, filterWait);
    let typed = query;

    if (!intendedInList(filtered) && optionSignature(filtered) === priorSig) {
      await focusAndOpenCombobox(html);
      await typeQueryIntoOpenCombobox(html, query);
      filtered = await waitForFilteredOptions(html, doc, priorSig, filterWait);
    }

    if (filtered.length) {
      options = filtered;
      const allowAi = intendedInList(filtered);
      const resolved = await matchFromCandidates(options, value, fieldLabel, typed, allowAi);
      match = resolved.match;
    }

    if (!match) {
      const words = query.split(/\s+/).filter(Boolean);
      typed = "";
      for (let i = 0; i < words.length; i += 1) {
        const word = words[i];
        typed = typed ? `${typed} ${word}` : word;
        await focusAndOpenCombobox(html);
        await typeQueryIntoOpenCombobox(html, typed);
        filtered = await waitForFilteredOptions(html, doc, priorSig, filterWait);
        if (!filtered.length) {
          options = initialOptions.length ? initialOptions : await openAndCollectOptions(html, doc);
          break;
        }
        options = filtered;
        const lastWord = i === words.length - 1;
        const allowAi = lastWord || intendedInList(filtered);
        const resolved = await matchFromCandidates(options, value, fieldLabel, typed, allowAi);
        match = resolved.match;
        if (match) break;
      }
    }
  }

  if (!match && initialOptions.length === 0) {
    dismissOpenOverlays(doc, html);
    await waitMs(450);
    options = await openAndCollectOptions(html, doc);
    const resolved = await matchFromCandidates(options, value, fieldLabel, null);
    match = resolved.match;
  } else if (!match) {
    options = initialOptions;
  }

  if (!match) {
    dismissOpenOverlays(doc, html);
    const sawFrom = options.length ? options : initialOptions;
    throw new Error(
      `No combobox option matching "${value}" (saw: ${sawFrom
        .slice(0, 6)
        .map(optionText)
        .join(" | ")})`,
    );
  }

  const label = optionText(match);
  const live = match.isConnected ? match : await findLiveOption(html, doc, label);
  const clickTarget = live || match;
  clickTarget.scrollIntoView({ block: "nearest", behavior: "auto" });
  pointerActivate(clickTarget);
  await waitMs(80);
  dismissOpenOverlays(doc, html);

  const displayed = readControlValue(html);
  const selected =
    displayed ||
    (html instanceof HTMLInputElement && html.value) ||
    html.getAttribute("data-value") ||
    optionText(match);

  return selected;
}
