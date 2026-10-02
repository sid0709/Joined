import type { TabTreeSummary } from "./tab-tree-cache";
import type { InspectKind } from "./use-tab-ui";

type AnalyzedTreeSectionProps = {
  lastFetch: TabTreeSummary;
  nodeCount: number;
  hasTree: boolean;
  hasPlan: boolean;
  onInspect: (kind: InspectKind, title: string) => void;
};

/** The active tab's last analyzed page, with buttons that open each inspector view. */
export function AnalyzedTreeSection({
  lastFetch,
  nodeCount,
  hasTree,
  hasPlan,
  onInspect,
}: AnalyzedTreeSectionProps) {
  return (
    <section className="preview">
      <h3>Analyzed tree</h3>
      <div className="preview-card">
        <div className="preview-title">{String(lastFetch.title ?? "Untitled")}</div>
        <div className="preview-url">{String(lastFetch.url ?? "")}</div>
        <div className="preview-meta">
          <span>{nodeCount} nodes</span>
          <span>{new Date(lastFetch.fetchedAt).toLocaleTimeString()}</span>
        </div>
        <div className="tree-actions">
          <button type="button" disabled={!hasTree} onClick={() => onInspect("pure", "Pure Tree")}>
            Pure Tree
          </button>
          <button type="button" disabled={!hasTree} onClick={() => onInspect("meta", "Meta Tree")}>
            Meta Tree
          </button>
          <button type="button" disabled={!hasPlan} onClick={() => onInspect("plan", "AI Analyze")}>
            {hasPlan ? "AI Analyze" : "AI Analyze (pending)"}
          </button>
        </div>
      </div>
    </section>
  );
}
