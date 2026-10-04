/* global chrome */
import { useEffect, useRef, useState } from "react";
import { DEFAULT_SCHEMA, REFINED_SYSTEM_INSTRUCTION } from "./order_stat.js";

//const defaultSchema = DEFAULT_SCHEMA;
//const SYSTEM_INSTRUCTION = REFINED_SYSTEM_INSTRUCTION;

export function useAgentState() {
  //	const [systemInstruction, setSystemInstruction] = useState(SYSTEM_INSTRUCTION);
  //	const [schema, setSchema] = useState(defaultSchema);
  //	const [selectedModel, setSelectedModel] = useState('gemini-flash-lite-latest');

  const [responseData, setResponseData] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [iterations, setIterations] = useState([]);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRef = useRef(false);
  const coverageWaiters = useRef(new Map());
  const domHintsWaiters = useRef([]);
  const [jobDescription, setJobDescription] = useState("");
  const [resumeInfo, setResumeInfo] = useState(null);
  const [executionResults, setExecutionResults] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [executableActions, setExecutableActions] = useState([]);
  //	const [isSchemaDialogOpen, setIsSchemaDialogOpen] = useState(false);

  return {
    //		systemInstruction, setSystemInstruction,
    //		schema, setSchema,
    //		selectedModel, setSelectedModel,
    responseData,
    setResponseData,
    coverage,
    setCoverage,
    iterations,
    setIterations,
    stopRequested,
    setStopRequested,
    stopRef,
    coverageWaiters,
    domHintsWaiters,
    jobDescription,
    setJobDescription,
    resumeInfo,
    setResumeInfo,
    executionResults,
    setExecutionResults,
    error,
    setError,
    isLoading,
    setIsLoading,
    executableActions,
    setExecutableActions,
    //		isSchemaDialogOpen, setIsSchemaDialogOpen
  };
}

export function useAgentListeners(
  setCoverage,
  coverageWaiters,
  domHintsWaiters,
  setExecutionResults,
) {
  useEffect(() => {
    const handler = (message) => {
      if (message?.action === "coverageResult") {
        setCoverage(message.payload);
        const id = message.payload?.identifier;
        if (id && coverageWaiters.current.has(id)) {
          const resolve = coverageWaiters.current.get(id);
          coverageWaiters.current.delete(id);
          resolve(message.payload);
        }
      } else if (message?.action === "domHintsResult") {
        const resolve = domHintsWaiters.current.shift();
        if (resolve) resolve(message.payload);
      } else if (message?.action === "executionResult") {
        setExecutionResults(message.payload);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [coverageWaiters, domHintsWaiters, setCoverage, setExecutionResults]);
}

export const waitForCoverage = (coverageWaiters, identifier) =>
  new Promise((resolve) => {
    coverageWaiters.current.set(identifier, resolve);
  });
