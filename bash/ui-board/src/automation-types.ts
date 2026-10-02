export type ActionStepType = "focus" | "click" | "type" | "wait" | "keydown" | "keyup";

export interface ActionStep {
  id: string;
  type: ActionStepType;
  text?: string;
  ms?: number;
  key?: string;
}

export interface NodeTargetPayload {
  nodeId: number;
  tabId: number;
  url: string;
  extensionId?: string;
}

export interface GetContentPayload extends NodeTargetPayload {
  contentType: "innerHTML" | "innerText";
}

export interface ExecuteActionsPayload extends NodeTargetPayload {
  steps: ActionStep[];
}

export interface DomCommandResult {
  ok?: boolean;
  content?: string;
  error?: string;
}
