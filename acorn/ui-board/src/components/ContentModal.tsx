import "./ActionBuilderModal.css";

interface Props {
  title: string;
  content: string;
  onClose: () => void;
}

export function ContentModal({ title, content, onClose }: Props) {
  const copy = async () => {
    await navigator.clipboard.writeText(content);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel content-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </header>
        <pre className="content-pre">{content || "(empty)"}</pre>
        <footer className="modal-footer">
          <button type="button" onClick={copy}>
            Copy
          </button>
          <button type="button" className="primary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
