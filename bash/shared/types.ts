export interface DomNode {
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
}

export interface DomTreeMessage extends DomTreePayload {
  meta?: {
    from: string;
    clientType: string;
    clientName: string;
    url: string;
    title: string;
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
