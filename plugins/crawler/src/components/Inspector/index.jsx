import {
  Badge,
  Button,
  Card,
  Code,
  CodeBlock,
  EmptyState,
  Glyph,
  HStack,
  NumberInput,
  Selector,
  Switch,
  Text,
  TextInput,
  VStack,
} from "@joined/design-system";
import { useEffect, useState } from "react";

import { useActiveTab } from "../../api/activeTab";
import { execRoutineOp } from "../../api/runtimeMessage";
import useNotification from "../../api/useNotification";

import {
  draftToField,
  draftToSnippet,
  EMPTY_DRAFT,
  isDraftComplete,
  READ_OPTIONS,
  TRANSFORM_OPTIONS,
} from "./fieldDraft";

/** How long typing must pause before the Inspector counts matches on the page. */
const MATCH_COUNT_DEBOUNCE_MS = 300;

function isValidSelector(selector) {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Live match count for the selector on the focused tab. Null while unknown. */
function useMatchCount(tabId, selector, isValid) {
  const [count, setCount] = useState(null);
  useEffect(() => {
    if (!tabId || !selector || !isValid) {
      setCount(null);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      execRoutineOp(tabId, { op: "count", selector })
        .then((result) => !cancelled && setCount(result.count ?? 0))
        .catch(() => !cancelled && setCount(null));
    }, MATCH_COUNT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tabId, selector, isValid]);
  return count;
}

function MatchBadge({ count }) {
  if (count === null) return null;
  if (!count) return <Badge variant="warning" label="No match" />;
  return <Badge variant="success" label={count === 1 ? "1 match" : `${count} matches`} />;
}

/** Try selectors and reads on the focused page, then copy the result as routine code. */
export default function Inspector() {
  const tab = useActiveTab();
  const notification = useNotification();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [result, setResult] = useState(null);
  const [isReading, setIsReading] = useState(false);

  const selector = draft.selector.trim();
  const selectorIsValid = !selector || isValidSelector(selector);
  const matchCount = useMatchCount(tab?.id, selector, selectorIsValid);
  const readOption = READ_OPTIONS.find((option) => option.value === draft.read);
  const canRead = Boolean(tab) && selectorIsValid && isDraftComplete(draft);

  const update = (changes) => setDraft((current) => ({ ...current, ...changes }));

  const runOp = async (payload, failure) => {
    try {
      return await execRoutineOp(tab.id, payload);
    } catch (error) {
      notification.fail(error, { key: "inspector" });
      if (failure) console.error(failure, error);
      return null;
    }
  };

  const readValue = async () => {
    setIsReading(true);
    const extracted = await runOp({ op: "extract", field: draftToField(draft) }, "Read failed");
    setResult(extracted);
    setIsReading(false);
  };

  const clickMatch = async () => {
    const clicked = await runOp({ op: "click", selector, nth: draft.nth, wait: 0 });
    if (clicked && !clicked.found) notification.warning(`No match #${draft.nth} to click.`);
  };

  if (!tab) {
    return (
      <Card padding={4}>
        <EmptyState
          isCompact
          headingLevel={3}
          icon={<Glyph name="search" />}
          title="Focus a web page to inspect"
          description="The Inspector works on the tab you are on."
        />
      </Card>
    );
  }

  return (
    <VStack gap={3}>
      <Card padding={4}>
        <VStack gap={4}>
          <HStack align="center" justify="between" gap={2}>
            <VStack gap={0.5}>
              <Text weight="semibold">Find elements</Text>
              <Text type="supporting" color="secondary" maxLines={1}>
                On {hostOf(tab.url)}
              </Text>
            </VStack>
            <MatchBadge count={matchCount} />
          </HStack>
          <TextInput
            label="CSS selector"
            placeholder="h1[class*='job-title']"
            value={draft.selector}
            onChange={(value) => update({ selector: value })}
            hasClear
            status={
              selectorIsValid ? undefined : { type: "error", message: "Not a valid CSS selector" }
            }
          />
          <HStack gap={2}>
            <Button
              variant="secondary"
              label="Highlight"
              icon={<Glyph name="eye" />}
              onClick={() => runOp({ op: "highlight", selector })}
              isDisabled={!selector || !selectorIsValid}
              width="100%"
            />
            <Button
              variant="secondary"
              label={`Click #${draft.nth}`}
              icon={<Glyph name="arrowRight" />}
              onClick={clickMatch}
              isDisabled={!selector || !selectorIsValid}
              width="100%"
            />
            <Button
              variant="ghost"
              label="Clear"
              icon={<Glyph name="close" />}
              onClick={() => runOp({ op: "clear" })}
              width="100%"
            />
          </HStack>
        </VStack>
      </Card>

      <Card padding={4}>
        <VStack gap={4}>
          <Text weight="semibold">Read a field</Text>
          <HStack gap={3}>
            <Selector
              label="Read"
              options={READ_OPTIONS.map(({ value, label }) => ({ value, label }))}
              value={draft.read}
              onChange={(value) => update({ read: value })}
              width="100%"
            />
            {readOption?.isNamed ? (
              <TextInput
                label="Name"
                placeholder={draft.read === "attr" ? "alt" : "href"}
                value={draft.name}
                onChange={(value) => update({ name: value })}
                width="100%"
              />
            ) : null}
          </HStack>
          <HStack gap={3}>
            <NumberInput
              label="Match"
              value={draft.nth}
              min={0}
              onChange={(value) => update({ nth: Math.max(0, Number(value) || 0) })}
              width="96px"
            />
            <TextInput
              label="Inside"
              isOptional
              placeholder="span"
              value={draft.inner}
              onChange={(value) => update({ inner: value })}
              width="100%"
            />
          </HStack>
          <Selector
            label="Then"
            options={TRANSFORM_OPTIONS}
            value={draft.transform}
            onChange={(value) => update({ transform: value })}
          />
          <Switch
            label="Read every match"
            value={draft.all}
            onChange={(value) => update({ all: value })}
          />
          <Button
            variant="primary"
            label="Read value"
            icon={<Glyph name="play" />}
            onClick={readValue}
            isDisabled={!canRead}
            isLoading={isReading}
            width="100%"
          />
          {result ? (
            <VStack gap={2}>
              <HStack gap={2} align="center">
                <Text type="supporting" weight="semibold">
                  Value
                </Text>
                <Badge
                  variant={result.found ? "success" : "warning"}
                  label={result.found ? "Found" : "Not on the page"}
                />
              </HStack>
              <CodeBlock
                code={JSON.stringify(result.value, null, 2) ?? "undefined"}
                language="json"
                size="sm"
                maxHeight={220}
                isWrapped
                hasCopyButton
              />
            </VStack>
          ) : null}
        </VStack>
      </Card>

      {isDraftComplete(draft) ? (
        <Card padding={4}>
          <VStack gap={2}>
            <Text weight="semibold">Routine code</Text>
            <Text type="supporting" color="secondary">
              Paste into a routine&apos;s <Code>fields</Code>.
            </Text>
            <CodeBlock
              code={draftToSnippet(draft)}
              language="javascript"
              size="sm"
              isWrapped
              hasCopyButton
            />
          </VStack>
        </Card>
      ) : null}
    </VStack>
  );
}
