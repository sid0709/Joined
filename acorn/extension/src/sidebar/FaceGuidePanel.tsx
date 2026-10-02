import { ACORN_FACE_HELP_PX } from "../acorn-face/constants";
import { ACORN_FACE_GUIDE } from "../acorn-face/guide";
import { AcornFaceView } from "../acorn-face/AcornFaceView";

type FaceGuidePanelProps = {
  thinking: number;
  working: number;
};

export function FaceGuidePanel({ thinking, working }: FaceGuidePanelProps) {
  const total = thinking + working;

  return (
    <section className="face-guide" aria-label="Acorn Face guide">
      <p className="hint">Each pose the rabbit uses while Fill or Custom is in flight.</p>
      <div className="face-guide-stats">
        <div className="face-guide-stat">
          <span className="face-guide-stat-n">{thinking}</span>
          <span className="face-guide-stat-label">Thinking</span>
        </div>
        <div className="face-guide-stat">
          <span className="face-guide-stat-n">{working}</span>
          <span className="face-guide-stat-label">Working</span>
        </div>
        <div className="face-guide-stat">
          <span className="face-guide-stat-n">{total}</span>
          <span className="face-guide-stat-label">Total</span>
        </div>
      </div>
      <ul className="face-guide-modes">
        {ACORN_FACE_GUIDE.map((row) => (
          <li key={row.mode} className="face-guide-mode">
            <AcornFaceView
              className="face-guide-face"
              mode={row.mode}
              size={ACORN_FACE_HELP_PX}
              live
              label={row.title}
            />
            <p className="face-guide-copy">
              <strong>{row.title}</strong>
              <span>{row.detail}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
