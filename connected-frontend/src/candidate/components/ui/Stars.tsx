import { Glyph } from "sid-ui";

export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="hx-score">
      <span className="hx-star">
        <Glyph name="star" size="0.95em" />
      </span>
      {value.toFixed(1)}
      {count !== undefined && <span className="hx-muted hx-small">({count})</span>}
    </span>
  );
}
