import { useCallback, useEffect, useRef, useState } from "react";
import { useRuntime } from "../../api/runtimeContext";
import useApi from "../../api/useApi";
import { SPIRIT_API_URL, persistSpiritApiUrlToStorage } from "../../config/env";
import { AgentUI } from "./UI";
import {
  highlightInteractables,
  executeActionsSequence,
} from "../../contentScript/interactionBridge";
import { useAgentState } from "./hooks";

/* global chrome */

function AgentPage() {
  const { addListener, removeListener } = useRuntime();
  const [componentsData, setComponentsData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState(null);
  const [executionReport, setExecutionReport] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [profileIdentifier, setProfileIdentifier] = useState("");
  const runIdRef = useRef(null);
  const lastHandledRunIdRef = useRef(null);

  const { executableActions, setExecutableActions, jobDescription, setJobDescription } =
    useAgentState();

  const spiritApi = useApi(SPIRIT_API_URL);
  const { get: spiritGet, post: spiritPost, baseUrl: spiritBaseUrl } = spiritApi;

  useEffect(() => {
    persistSpiritApiUrlToStorage();
  }, [spiritBaseUrl]);

  useEffect(() => {
    try {
      if (typeof chrome === "undefined" || !chrome.storage?.local) return;
      chrome.storage.local.get("autolancerProfileIdentifier", (result) => {
        const value = result?.autolancerProfileIdentifier;
        if (typeof value === "string") setProfileIdentifier(value);
      });
    } catch (e) {
      console.error("Failed to load profile identifier from storage:", e);
    }
  }, []);

  useEffect(() => {
    if (!spiritBaseUrl) return;
    let canceled = false;

    (async () => {
      try {
        const result = await spiritGet("/profiles");
        const list = Array.isArray(result?.profiles) ? result.profiles : [];
        if (canceled) return;
        setProfiles(list);
        const hasSelected = list.some((p) => p?.identifier === profileIdentifier);
        if ((!profileIdentifier || !hasSelected) && list.length) {
          const next = list[0].identifier;
          setProfileIdentifier(next);
          try {
            chrome.storage?.local?.set?.({ autolancerProfileIdentifier: next });
          } catch (e) {
            console.error("Failed to persist default profile identifier:", e);
          }
        }
      } catch (e) {
        console.error("Failed to fetch profiles:", e);
        if (!canceled) setProfiles([]);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [profileIdentifier, spiritBaseUrl, spiritGet]);

  const deriveSelectorFromSerializedElement = useCallback((serializedElement) => {
    const tag = serializedElement?.tag;
    const props = serializedElement?.properties || {};
    if (!tag) return null;

    if (props["data-autolancer-group-id"])
      return {
        componentType: tag,
        propertyName: "data-autolancer-group-id",
        pattern: props["data-autolancer-group-id"],
      };
    if (props.id) return { componentType: tag, propertyName: "id", pattern: props.id };
    if (props.name) return { componentType: tag, propertyName: "name", pattern: props.name };

    if (tag === "input" && props.value) {
      const inputType = String(props.type || "").toLowerCase();
      if (["radio", "checkbox", "button", "submit"].includes(inputType)) {
        return { componentType: tag, propertyName: "value", pattern: props.value };
      }
    }

    if (props["data-testid"])
      return { componentType: tag, propertyName: "data-testid", pattern: props["data-testid"] };
    if (props["data-cy"])
      return { componentType: tag, propertyName: "data-cy", pattern: props["data-cy"] };
    if (props["data-automation-id"])
      return {
        componentType: tag,
        propertyName: "data-automation-id",
        pattern: props["data-automation-id"],
      };
    if (props["aria-label"])
      return { componentType: tag, propertyName: "aria-label", pattern: props["aria-label"] };
    if (props.placeholder)
      return { componentType: tag, propertyName: "placeholder", pattern: props.placeholder };

    const classAttr = props.class || "";
    const firstClass = String(classAttr).split(/\s+/).filter(Boolean)[0];
    if (firstClass)
      return { componentType: tag, propertyName: "class", pattern: `?${firstClass}?` };

    return null;
  }, []);

  const pickChildFromGroup = useCallback((group, command, childIndex) => {
    const children = Array.isArray(group?.Children) ? group.Children : [];
    const idx = Number.isFinite(childIndex) ? childIndex : parseInt(childIndex, 10);

    if (Number.isFinite(idx) && idx >= 0 && idx < children.length) return children[idx];

    if (command === "TYPING") {
      return children.find((c) => c?.tag === "input" || c?.tag === "textarea") || null;
    }
    if (command === "CLICK") {
      return (
        children.find(
          (c) =>
            c?.tag === "button" ||
            c?.tag === "a" ||
            c?.tag === "label" ||
            (c?.tag === "input" &&
              ["radio", "checkbox", "button", "submit"].includes(
                String(c?.properties?.type || "").toLowerCase(),
              )),
        ) || null
      );
    }
    if (command === "UPLOAD" || command === "FILEUPLOAD") {
      return (
        children.find(
          (c) => c?.tag === "input" && String(c?.properties?.type || "").toLowerCase() === "file",
        ) ||
        children.find((c) => c?.tag === "input") ||
        null
      );
    }
    if (command === "SELECT_OPTION") {
      return (
        children.find((c) => c?.tag === "select") ||
        children.find(
          (c) =>
            c?.tag === "input" &&
            (c?.properties?.["aria-haspopup"] === "true" ||
              String(c?.properties?.role || "").toLowerCase() === "button"),
        ) ||
        children.find(
          (c) =>
            c?.tag === "a" &&
            String(c?.properties?.class || "")
              .split(/\s+/)
              .includes("select2-choice"),
        ) ||
        null
      );
    }

    return null;
  }, []);

  const analyzeComponents = useCallback(
    async (payload) => {
      if (!payload) return;
      if (!spiritBaseUrl) {
        setError(
          "Spirit AI service is not configured. Set VITE_SPIRIT_API_URL in Extension/.env and reload.",
        );
        setAnalysisData(null);
        setExecutableActions([]);
        return;
      }
      setLoading(true);
      setError(null);
      setExecutableActions([]);
      setExecuting(false);
      setExecutionReport(null);

      console.log("Sending analyze request with payload:", payload);

      try {
        const body = {
          userInput: JSON.stringify(payload, null, 2),
          jobDescription: (jobDescription || "").trim(),
          profileIdentifier: profileIdentifier || "",
        };
        const result = await spiritPost("/analyze", body);
        setAnalysisData(result || null);

        console.log("Analyze result:", result);

        if (Array.isArray(result?.payload) && Array.isArray(payload?.components)) {
          const actions = [];
          for (let i = 0; i < result.payload.length; i++) {
            const item = result.payload[i];
            const group = payload.components[i];
            if (!group) continue;

            const suggestion = item?.action_suggestion || item?.insights?.action_suggestion || null;
            const command = suggestion?.command || null;
            if (!command) continue;
            if (
              command !== "TYPING" &&
              command !== "CLICK" &&
              command !== "SELECT_OPTION" &&
              command !== "UPLOAD" &&
              command !== "FILEUPLOAD"
            )
              continue;

            const scopeSelector = deriveSelectorFromSerializedElement(group?.Parent);
            const hasScope = Boolean(scopeSelector?.pattern);

            const childIndex = suggestion?.payload?.childIndex;
            const targetSerializedElement = pickChildFromGroup(group, command, childIndex);
            if (!targetSerializedElement) continue;

            const props = targetSerializedElement?.properties || {};
            const tag = targetSerializedElement?.tag;
            if (props.disabled !== undefined) continue;
            if (props.readonly !== undefined) continue;

            const inputType = String(props.type || "").toLowerCase();
            if (command === "TYPING") {
              if (!(tag === "input" || tag === "textarea")) continue;
              if (
                tag === "input" &&
                ["hidden", "file", "checkbox", "radio", "button", "submit", "reset"].includes(
                  inputType,
                )
              )
                continue;

              const classList = String(props.class || "")
                .split(/\s+/)
                .filter(Boolean);
              const isSelect2Like =
                classList.includes("select2-focusser") ||
                String(props.id || "").startsWith("s2id_");
              const isAriaDropdown =
                props["aria-haspopup"] === "true" ||
                String(props.role || "").toLowerCase() === "button";
              if (isSelect2Like || isAriaDropdown) continue;

              const value = suggestion?.payload?.value;
              if (!value) continue;

              if (hasScope && Number.isFinite(parseInt(childIndex, 10))) {
                actions.push({
                  action: "fillScoped",
                  scope: scopeSelector,
                  childIndex: parseInt(childIndex, 10),
                  value,
                });
              } else {
                const selector = deriveSelectorFromSerializedElement(targetSerializedElement);
                if (!selector?.pattern) continue;
                actions.push({ ...selector, order: 0, action: "fill", value });
              }
            } else if (command === "CLICK") {
              // Avoid auto-submitting even if backend accidentally emits it.
              const looksLikeSubmit = String(targetSerializedElement?.innerText || "")
                .toLowerCase()
                .includes("submit");
              if (looksLikeSubmit) continue;

              if (hasScope && Number.isFinite(parseInt(childIndex, 10))) {
                actions.push({
                  action: "clickScoped",
                  scope: scopeSelector,
                  childIndex: parseInt(childIndex, 10),
                });
              } else {
                const selector = deriveSelectorFromSerializedElement(targetSerializedElement);
                if (!selector?.pattern) continue;
                actions.push({ ...selector, order: 0, action: "click" });
              }
            } else if (command === "SELECT_OPTION") {
              const selectionValue =
                suggestion?.payload?.selectionValue ?? suggestion?.payload?.value;
              const selectedIndex = suggestion?.payload?.selectedIndex;
              if (!selectionValue) continue;

              if (hasScope && Number.isFinite(parseInt(childIndex, 10))) {
                actions.push({
                  action: "selectByTextScoped",
                  scope: scopeSelector,
                  childIndex: parseInt(childIndex, 10),
                  value: selectionValue,
                  selectedIndex,
                });
              } else {
                const selector = deriveSelectorFromSerializedElement(targetSerializedElement);
                if (!selector?.pattern) continue;
                actions.push({
                  ...selector,
                  order: 0,
                  action: "selectByText",
                  value: selectionValue,
                  selectedIndex,
                });
              }
            } else if (command === "UPLOAD" || command === "FILEUPLOAD") {
              const filePath = suggestion?.payload?.value;
              const field = suggestion?.payload?.field || item?.insights?.field || null;
              if (!filePath) continue;

              if (hasScope && Number.isFinite(parseInt(childIndex, 10))) {
                actions.push({
                  action: "uploadFileScoped",
                  scope: scopeSelector,
                  childIndex: parseInt(childIndex, 10),
                  value: filePath,
                  field,
                });
              } else if (hasScope) {
                actions.push({
                  action: "uploadFileScoped",
                  scope: scopeSelector,
                  value: filePath,
                  field,
                });
              } else {
                const selector = deriveSelectorFromSerializedElement(targetSerializedElement);
                if (!selector?.pattern) continue;
                actions.push({
                  ...selector,
                  order: 0,
                  action: "uploadFile",
                  value: filePath,
                  field,
                });
              }
            }
          }
          setExecutableActions(actions);
        }
      } catch (e) {
        console.error("Analyze request failed:", e);
        setError(e?.data || e?.message || "Analyze failed");
      } finally {
        setLoading(false);
      }
    },
    [
      deriveSelectorFromSerializedElement,
      pickChildFromGroup,
      jobDescription,
      profileIdentifier,
      spiritBaseUrl,
      spiritPost,
      setExecutableActions,
    ],
  );

  useEffect(() => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get("autolancerJobDescription", (result) => {
          const value = result?.autolancerJobDescription;
          if (typeof value === "string") setJobDescription(value);
        });
      }
    } catch (e) {
      console.error("Failed to load job description from storage:", e);
    }
  }, [setJobDescription]);

  useEffect(() => {
    const listener = (message) => {
      if (message?.action === "interactablesResult") {
        const incomingRunId = message?.payload?.runId || null;
        // Normalize to current run when payload doesn't include the id (older content script)
        const normalizedRunId = incomingRunId || runIdRef.current || "__legacy__";
        if (lastHandledRunIdRef.current === normalizedRunId) return; // ignore duplicate
        lastHandledRunIdRef.current = normalizedRunId;

        setComponentsData(message.payload);
        // Kick off backend analysis
        analyzeComponents(message.payload);
      } else if (message?.action === "executeActionsParallelResult") {
        const runId = message?.payload?.runId || null;
        const isCurrentRun = !runId || runId === runIdRef.current;
        if (isCurrentRun) {
          setExecuting(false);
          setExecutionReport(message.payload || null);
        }
      } else if (message?.action === "executeActionsSequenceResult") {
        const runId = message?.payload?.runId || null;
        const isCurrentRun = !runId || runId === runIdRef.current;
        if (isCurrentRun) {
          setExecuting(false);
          setExecutionReport(message.payload || null);
        }
      }
    };
    addListener(listener);
    return () => removeListener(listener);
  }, [addListener, removeListener, analyzeComponents]);

  const handleJobDescriptionChange = useCallback(
    (value) => {
      setJobDescription(value);
      try {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
          chrome.storage.local.set({ autolancerJobDescription: value });
        }
      } catch (e) {
        console.error("Failed to persist job description:", e);
      }
    },
    [setJobDescription],
  );

  const handleProfileChange = useCallback((value) => {
    setProfileIdentifier(value);
    try {
      chrome.storage?.local?.set?.({ autolancerProfileIdentifier: value });
    } catch (e) {
      console.error("Failed to persist profile identifier:", e);
    }
  }, []);

  const handleAnalyze = () => {
    try {
      const runId =
        crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      runIdRef.current = runId;
      lastHandledRunIdRef.current = null;
      setComponentsData(null);
      setAnalysisData(null);
      setExecutableActions([]);
      setExecuting(false);
      highlightInteractables(runId);
    } catch (e) {
      console.error("Analyze failed:", e);
    }
  };

  const handleExecute = () => {
    if (!executableActions.length) return;
    if (executing) return;

    setExecuting(true);
    console.log("Executing actions:", executableActions);
    executeActionsSequence(executableActions, runIdRef.current);
  };

  const hasExecutableActions = executableActions.length > 0;

  return (
    <AgentUI
      onAnalyze={handleAnalyze}
      onExecute={handleExecute}
      loading={loading}
      executing={executing}
      error={error}
      profiles={profiles}
      profileIdentifier={profileIdentifier}
      onProfileChange={handleProfileChange}
      jobDescription={jobDescription}
      onJobDescriptionChange={handleJobDescriptionChange}
      componentsData={componentsData}
      analysisData={analysisData}
      hasExecutableActions={hasExecutableActions}
      executionReport={executionReport}
    />
  );
}

export default AgentPage;
