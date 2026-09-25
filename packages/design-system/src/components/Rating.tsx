"use client";

import { useState } from "react";

export const RATING_MAX = 5;

export interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
  /** Hides the numeric score. The marks still expose it to assistive tech. */
  showValue?: boolean;
  caption?: string;
}

/** A star score. The number is always written next to the marks. */
export function Rating({
  value,
  onChange,
  max = RATING_MAX,
  readOnly = false,
  size = "md",
  label = "Rating",
  showValue = true,
  caption,
}: RatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  const interactive = Boolean(onChange) && !readOnly;

  return (
    <div className={`os-rating os-rating-${size}`}>
      <div
        className="os-rating-stars"
        role={interactive ? "radiogroup" : "img"}
        aria-label={interactive ? label : `${label}, ${value} of ${max}`}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: max }, (_, index) => {
          const star = index + 1;
          const filled = shown >= star;
          if (!interactive) {
            return (
              <span key={star} className={filled ? "os-star os-star-on" : "os-star"} aria-hidden>
                ★
              </span>
            );
          }
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} of ${max}`}
              className={filled ? "os-star os-star-on" : "os-star"}
              onMouseEnter={() => setHover(star)}
              onFocus={() => setHover(star)}
              onBlur={() => setHover(null)}
              onClick={() => onChange?.(star)}
            >
              ★
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="os-rating-value">
          {value} / {max}
        </span>
      )}
      {caption && <span className="os-rating-caption">{caption}</span>}
    </div>
  );
}
