import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ActionStep } from "./automation-types";
import type { ClientInfo, DomNode, DomTreeMessage, HighlightPayload } from "./types";
import { fetchRuntimeFile, requestAiAnalyze } from "./ai-client";
import {
  DEFAULT_ATHENS_API_URL,
  getAccessToken,
  getAthensApiUrl,
  getOakSession,
  oakSignIn,
  oakSignOut,
  OAK_SOCKET_PATH,
  setAthensApiUrl,
  type OakStoredSession,
} from "./auth/oak-auth";
import { formatMetaTreePreview, formatPureTreePreview, splitDomTree } from "./tree-export";
import { ActionBuilderModal } from "./components/ActionBuilderModal";
import { ContentModal } from "./components/ContentModal";
import { ContextMenu, type ContextMenuState } from "./components/ContextMenu";
import { DomTreeView } from "./components/DomTreeView";
import { PlanRunModal } from "./components/PlanRunModal";
import { QaBoard } from "./components/QaBoard";
import { runActionPlan } from "./plan-runner/orchestrator";
import type { ActionPlan, PauseDecision, PauseRequest, RunStepRecord } from "./plan-runner/types";
import "./App.css";

export default function App() {
  const [serverUrl, setServerUrl] = useState(() => getAthensApiUrl());
  const [session, setSession] = useState<OakStoredSession | null>(() => getOakSession());
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [latestTree, setLatestTree] = useState<DomTreeMessage | null>(null);
  const [history, setHistory] = useState<DomTreeMessage[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [contextNode, setContextNode] = useState<DomNode | null>(null);
  const [contentModal, setContentModal] = useState<{ title: string; content: string } | null>(null);
  const [actionModalNode, setActionModalNode] = useState<DomNode | null>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [aiAnalyzeRunning, setAiAnalyzeRunning] = useState(false);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [planRunOpen, setPlanRunOpen] = useState(false);
  const [planRunRunning, setPlanRunRunning] = useState(false);
  const [planRunSteps, setPlanRunSteps] = useState<RunStepRecord[]>([]);
  const [planPause, setPlanPause] = useState<PauseRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pauseResolverRef = useRef<((decision: PauseDecision) => void) | null>(null);

  useEffect(() => {
    setAthensApiUrl(serverUrl);
    const token = getAccessToken();
    if (!token || !session) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(serverUrl, {
      path: OAK_SOCKET_PATH,
      auth: { token },
      query: { type: "ui-board", name: "Oak UI Board" },
      withCredentials: false,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("clients:update", (list: ClientInfo[]) => setClients(list));
    socket.on("connected", (data: { clients: ClientInfo[] }) => setClients(data.clients));
    socket.on("dom:tree", (payload: DomTreeMessage) => {
      setLatestTree(payload);
      setSelectedNodeId(null);
      setHistory((prev) => [payload, ...prev].slice(0, 20));
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl, session]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSignIn = async () => {
    setAuthBusy(true);
    try {
      const next = await oakSignIn(authName.trim(), authPassword, serverUrl);
      setSession(next);
      setAuthPassword("");
      showToast(`Signed in as ${next.displayName}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      await oakSignOut();
      setSession(null);
      showToast("Signed out");
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const getTarget = useCallback(
    (node: DomNode) => {
      const tabId = latestTree?.meta?.tabId ?? latestTree?.tabId;
      if (!tabId || !latestTree) return null;
      return {
        nodeId: node.nodeId,
        tabId,
        url: latestTree.url,
        extensionId: latestTree.meta?.from,
      };
    },
    [latestTree],
  );

  const handleNodeClick = useCallback(
    (node: DomNode) => {
      const target = getTarget(node);
      if (!target) return;

      setSelectedNodeId(node.nodeId);
      socketRef.current?.emit("dom:highlight", target satisfies HighlightPayload);
    },
    [getTarget],
  );

  const handleNodeContextMenu = useCallback((node: DomNode, x: number, y: number) => {
    setContextNode(node);
    setSelectedNodeId(node.nodeId);
    setContextMenu({ x, y, nodeLabel: formatNodeLabel(node) });
  }, []);

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const fetchContent = (contentType: "innerHTML" | "innerText") => {
    if (!contextNode) return;
    const target = getTarget(contextNode);
    if (!target) {
      showToast("No active page session");
      return;
    }

    closeContextMenu();
    const socket = socketRef.current;
    if (!socket) return;

    socket
      .timeout(15000)
      .emit(
        "dom:get-content",
        { ...target, contentType },
        (err: Error | null, res: { content?: string; error?: string }) => {
          if (err) {
            showToast(err.message ?? "Request failed");
            return;
          }
          if (res?.error) {
            showToast(res.error);
            return;
          }
          setContentModal({
            title: contentType === "innerHTML" ? "Element HTML" : "Inner Text",
            content: res?.content ?? "",
          });
        },
      );
  };

  const runActions = (steps: ActionStep[]) => {
    if (!actionModalNode) return;
    const target = getTarget(actionModalNode);
    if (!target) {
      showToast("No active page session");
      return;
    }

    const socket = socketRef.current;
    if (!socket) return;

    setActionRunning(true);
    const totalWait = steps
      .filter((s) => s.type === "wait")
      .reduce((sum, s) => sum + (s.ms ?? 0), 0);
    const timeout = Math.max(15000, totalWait + 10000);

    socket.timeout(timeout).emit(
      "dom:execute-actions",
      {
        ...target,
        steps: steps.map(({ type, text, ms, key }) => ({ type, text, ms, key })),
      },
      (err: Error | null, res: { ok?: boolean; error?: string }) => {
        setActionRunning(false);
        if (err) {
          showToast(err.message ?? "Action failed");
          return;
        }
        if (res?.error) {
          showToast(res.error);
          return;
        }
        showToast("Actions completed");
        setActionModalNode(null);
      },
    );
  };

  const nodeCount = latestTree?.meta?.nodeCount ?? countNodes(latestTree?.tree);

  const splitTrees = useMemo(() => {
    if (!latestTree?.tree) return null;
    return splitDomTree(latestTree.tree);
  }, [latestTree]);

  const openPureTreeModal = () => {
    if (!splitTrees) return;
    setContentModal({
      title: "Pure Tree",
      content: formatPureTreePreview(splitTrees.pure),
    });
  };

  const openMetaTreeModal = () => {
    if (!splitTrees) return;
    setContentModal({
      title: "Meta Tree",
      content: formatMetaTreePreview(splitTrees.meta, splitTrees.pure),
    });
  };

  const handleAiAnalyze = async () => {
    if (!latestTree || !splitTrees || aiAnalyzeRunning) return;
    if (!session) {
      showToast("Sign in to Athens first");
      return;
    }

    setAiAnalyzeRunning(true);
    try {
      const pureTree = formatPureTreePreview(splitTrees.pure);
      const result = await requestAiAnalyze({
        pureTree,
        page: {
          title: latestTree.title || "Untitled",
          url: latestTree.url,
          fetchedAt: latestTree.fetchedAt,
        },
      });

      const plan = result.plan as ActionPlan;
      setActionPlan(plan);
      setContentModal({
        title: "AI Analyze",
        content: JSON.stringify(plan, null, 2),
      });
      showToast("AI analyze complete — click Run to execute");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setContentModal({
        title: "AI Analyze Error",
        content: message,
      });
      showToast("AI analyze failed");
    } finally {
      setAiAnalyzeRunning(false);
    }
  };

  const requestPauseDecision = useCallback((request: PauseRequest) => {
    setPlanPause(request);
    return new Promise<PauseDecision>((resolve) => {
      pauseResolverRef.current = resolve;
    });
  }, []);

  const handlePauseDecision = (decision: PauseDecision) => {
    setPlanPause(null);
    const resolve = pauseResolverRef.current;
    pauseResolverRef.current = null;
    resolve?.(decision);
  };

  const handlePlanRun = async () => {
    if (!latestTree || !actionPlan || planRunRunning) return;

    const tabId = latestTree.meta?.tabId ?? latestTree.tabId;
    if (!tabId) {
      showToast("No active page session");
      return;
    }

    const socket = socketRef.current;
    if (!socket) {
      showToast("Not connected to backend");
      return;
    }

    setPlanRunOpen(true);
    setPlanRunRunning(true);
    setPlanRunSteps([]);
    setPlanPause(null);

    try {
      const runtimeFile = await fetchRuntimeFile();
      const report = await runActionPlan({
        plan: actionPlan,
        socket,
        tabId,
        url: latestTree.url,
        extensionId: latestTree.meta?.from,
        frameId: latestTree.meta?.frameId ?? latestTree.frameId ?? null,
        runtimeFile,
        recommendedResume: null,
        hooks: {
          onSteps: setPlanRunSteps,
          onPause: requestPauseDecision,
        },
      });

      if (report.aborted) showToast("Plan run aborted");
      else if (report.ok) showToast("Plan run complete");
      else showToast("Plan run finished with issues");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(`Plan run failed: ${message}`);
    } finally {
      setPlanRunRunning(false);
      setPlanPause(null);
      pauseResolverRef.current = null;
    }
  };

  const canRunPlan = Boolean(
    actionPlan &&
    (latestTree?.meta?.tabId ?? latestTree?.tabId) &&
    !planRunRunning &&
    !aiAnalyzeRunning,
  );

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <img className="logo" src="/logo.png" alt="Oak" width={44} height={44} />
          <div>
            <h1>Oak DOM Tree Board</h1>
            <p className="subtitle">Live DOM snapshots from the Chrome extension</p>
          </div>
        </div>
        <div className="header-right">
          <div className="server-input">
            <label htmlFor="server">Athens API</label>
            <input
              id="server"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder={DEFAULT_ATHENS_API_URL}
            />
          </div>
          {session ? (
            <div className="auth-box signed-in">
              <span className="auth-user">{session.displayName}</span>
              <button type="button" onClick={() => void handleSignOut()} disabled={authBusy}>
                Sign out
              </button>
            </div>
          ) : (
            <div className="auth-box">
              <input
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="Username"
                autoComplete="username"
              />
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSignIn();
                }}
              />
              <button
                type="button"
                onClick={() => void handleSignIn()}
                disabled={authBusy || !authName.trim() || !authPassword}
              >
                {authBusy ? "…" : "Sign in"}
              </button>
            </div>
          )}
          <div className={`status ${connected ? "online" : "offline"}`}>
            <span className="dot" />
            {connected ? "Connected" : session ? "Disconnected" : "Sign in"}
          </div>
        </div>
      </header>

      <div className="meta-bar">
        <div className="meta-item">
          <span className="meta-label">Clients</span>
          <span className="meta-value">{clients.length}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Extensions</span>
          <span className="meta-value">{clients.filter((c) => c.type === "extension").length}</span>
        </div>
        {latestTree && (
          <>
            <div className="meta-item wide">
              <span className="meta-label">Page</span>
              <span className="meta-value truncate" title={latestTree.url}>
                {latestTree.title || latestTree.url}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Nodes</span>
              <span className="meta-value">{nodeCount}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Fetched</span>
              <span className="meta-value">
                {new Date(latestTree.fetchedAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="tree-actions">
              <button type="button" onClick={openPureTreeModal}>
                Pure Tree
              </button>
              <button type="button" onClick={openMetaTreeModal}>
                Meta Tree
              </button>
              <button
                type="button"
                className="primary"
                disabled={!session || !splitTrees || aiAnalyzeRunning || planRunRunning}
                onClick={handleAiAnalyze}
              >
                {aiAnalyzeRunning ? "Analyzing..." : "AI Analyze"}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!canRunPlan}
                onClick={handlePlanRun}
              >
                {planRunRunning ? "Running..." : "Run"}
              </button>
            </div>
          </>
        )}
      </div>

      <main className="main">
        {latestTree ? (
          <DomTreeView
            tree={latestTree.tree}
            selectedNodeId={selectedNodeId}
            onNodeClick={handleNodeClick}
            onNodeContextMenu={handleNodeContextMenu}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">⬡</div>
            <h2>Waiting for DOM tree</h2>
            <p>
              Open the Oak Chrome extension on any page and click
              <strong> Fetch DOM</strong> to see the tree here.
            </p>
          </div>
        )}
      </main>

      <QaBoard
        signedIn={Boolean(session)}
        page={latestTree ? { title: latestTree.title, url: latestTree.url } : null}
      />

      {history.length > 1 && (
        <aside className="history">
          <h3>History</h3>
          <ul>
            {history.map((item, i) => (
              <li key={`${item.fetchedAt}-${i}`}>
                <button
                  type="button"
                  className={item === latestTree ? "active" : ""}
                  onClick={() => setLatestTree(item)}
                >
                  <span className="hist-title">{item.title || "Untitled"}</span>
                  <span className="hist-time">{new Date(item.fetchedAt).toLocaleTimeString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <ContextMenu
        menu={contextMenu}
        onClose={closeContextMenu}
        onGetInnerHtml={() => fetchContent("innerHTML")}
        onGetInnerText={() => fetchContent("innerText")}
        onAction={() => {
          closeContextMenu();
          if (contextNode) setActionModalNode(contextNode);
        }}
      />

      {contentModal && (
        <ContentModal
          title={contentModal.title}
          content={contentModal.content}
          onClose={() => setContentModal(null)}
        />
      )}

      {actionModalNode && (
        <ActionBuilderModal
          nodeLabel={formatNodeLabel(actionModalNode)}
          running={actionRunning}
          onClose={() => !actionRunning && setActionModalNode(null)}
          onRun={runActions}
        />
      )}

      {planRunOpen && actionPlan && (
        <PlanRunModal
          goal={actionPlan.goal}
          running={planRunRunning}
          steps={planRunSteps}
          pause={planPause}
          onPauseDecision={handlePauseDecision}
          onClose={() => {
            if (planRunRunning || planPause) return;
            setPlanRunOpen(false);
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function formatNodeLabel(node: DomNode): string {
  let label = `<${node.tag}`;
  if (node.id) label += `#${node.id}`;
  if (node.classes?.length) label += `.${node.classes[0]}`;
  label += ">";
  return label;
}

function countNodes(node: DomTreeMessage["tree"] | undefined): number {
  if (!node) return 0;
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}
