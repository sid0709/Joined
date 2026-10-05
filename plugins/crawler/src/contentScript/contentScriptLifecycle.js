export const CONTENT_SCRIPT_INJECTED_ATTRIBUTE = "data-autolancer-content-script-injected";

export function isExtensionContextInvalidatedError(error) {
  return /extension context invalidated/i.test(String(error?.message || error || ""));
}

export function hasLiveExtensionRuntime(runtime) {
  try {
    return Boolean(runtime?.id && typeof runtime.sendMessage === "function");
  } catch {
    return false;
  }
}

/** Send without surfacing the expected error produced by an extension reload. */
export function sendRuntimeMessageSafely(runtime, message, handlers = {}) {
  const { onInvalidated, onError } = handlers;
  const handleError = (error) => {
    if (isExtensionContextInvalidatedError(error) || !hasLiveExtensionRuntime(runtime)) {
      onInvalidated?.(error);
      return false;
    }
    onError?.(error);
    return false;
  };

  if (!hasLiveExtensionRuntime(runtime)) {
    onInvalidated?.();
    return false;
  }

  try {
    const result = runtime.sendMessage(message);
    if (result && typeof result.catch === "function") {
      result.catch(handleError);
    }
    return true;
  } catch (error) {
    return handleError(error);
  }
}
