type MessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];

/** A runtime message, typed exactly as `chrome.runtime.onMessage` hands it over. */
export type RuntimeMessage = Parameters<MessageListener>[0];
export type SendResponse = Parameters<MessageListener>[2];

/** Shown when a sidebar action needs an Acorn session and there is none. */
export const SIGN_IN_FIRST = "Sign in on the Acorn site, then open the sidebar";
