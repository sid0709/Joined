import type { DomNode } from "../types";
import "./DomTreeView.css";

interface Props {
  tree: DomNode;
  selectedNodeId: number | null;
  onNodeClick: (node: DomNode) => void;
  onNodeContextMenu: (node: DomNode, x: number, y: number) => void;
}

export function DomTreeView({ tree, selectedNodeId, onNodeClick, onNodeContextMenu }: Props) {
  return (
    <div className="tree-container">
      <div className="tree-canvas">
        <TreeNode
          node={tree}
          depth={0}
          isLast
          selectedNodeId={selectedNodeId}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
        />
      </div>
    </div>
  );
}

interface TreeNodeProps {
  node: DomNode;
  depth: number;
  isLast: boolean;
  prefix?: string;
  selectedNodeId: number | null;
  onNodeClick: (node: DomNode) => void;
  onNodeContextMenu: (node: DomNode, x: number, y: number) => void;
}

function TreeNode({
  node,
  depth,
  isLast,
  prefix = "",
  selectedNodeId,
  onNodeClick,
  onNodeContextMenu,
}: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const branch = prefix + (isLast ? "└── " : "├── ");
  const childPrefix = prefix + (isLast ? "    " : "│   ");
  const label = formatLabel(node);
  const isSelected = selectedNodeId === node.nodeId;

  return (
    <div className={`tree-branch depth-${Math.min(depth, 8)}`}>
      <div className="tree-line">
        {depth > 0 && <span className="tree-glyph">{branch}</span>}
        <button
          type="button"
          className={`node-card ${isSelected ? "selected" : ""}`}
          title={label}
          onClick={() => onNodeClick(node)}
          onContextMenu={(e) => {
            e.preventDefault();
            onNodeContextMenu(node, e.clientX, e.clientY);
          }}
        >
          <span className="tag">{node.tag}</span>
          {node.id && <span className="node-id">#{node.id}</span>}
          {node.classes && node.classes.length > 0 && (
            <span className="node-class">.{node.classes.join(".")}</span>
          )}
          {node.text && <span className="node-text">"{node.text}"</span>}
          {hasChildren && <span className="child-badge">{node.childCount}</span>}
        </button>
      </div>

      {hasChildren &&
        node.children.map((child, i) => (
          <TreeNode
            key={`oak-node-${child.nodeId}`}
            node={child}
            depth={depth + 1}
            isLast={i === node.children.length - 1}
            prefix={childPrefix}
            selectedNodeId={selectedNodeId}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
          />
        ))}
    </div>
  );
}

function formatLabel(node: DomNode): string {
  let label = `<${node.tag}`;
  if (node.id) label += ` id="${node.id}"`;
  if (node.classes?.length) label += ` class="${node.classes.join(" ")}"`;
  label += ">";
  if (node.text) label += ` ${node.text}`;
  return label;
}
