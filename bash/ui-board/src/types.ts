export interface DomNode {
  nodeId: number;
  tag: string;
  id?: string;
  classes?: string[];
  attrs?: Record<string, string>;
  text?: string;
  childCount: number;
  children: DomNode[];
}

export interface DomTreePayload {
  url: string;
  title: string;
  tree: DomNode;
  fetchedAt: string;
  tabId?: number;
  frameId?: number;
}

export interface DomTreeMessage extends DomTreePayload {
  meta?: {
    from: string;
    clientType: string;
    clientName: string;
    url: string;
    title: string;
    tabId: number | null;
    frameId?: number | null;
    timestamp: number;
    nodeCount: number;
  };
}

export interface ClientInfo {
  id: string;
  type: string;
  name: string;
  connectedAt: number;
}

export interface HighlightPayload {
  nodeId: number;
  tabId: number;
  url: string;
  extensionId?: string;
}
