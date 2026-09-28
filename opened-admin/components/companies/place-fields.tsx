"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  US_STATES,
  formatAddress,
  joinLocations,
  parseAddress,
  splitLocations,
  type Address,
} from "@openseat/design-system/places";

const PLACES_MIN_QUERY = 3;
const PLACES_DEBOUNCE_MS = 300;
const GEOAPIFY_ATTRIBUTION_HREF = "https://www.geoapify.com/";

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-ink";
const labelClass = "flex flex-col gap-1 text-sm";
const labelTextClass = "text-xs font-medium text-muted";

type PlaceHit = Address & {
  id: string;
  label: string;
};

function stateAbbreviation(value: string) {
  const trimmed = value.trim();
  const byAbbreviation = US_STATES.find(
    (state) => state.abbreviation.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byAbbreviation) return byAbbreviation.abbreviation;
  const byName = US_STATES.find((state) => state.name.toLowerCase() === trimmed.toLowerCase());
  return byName?.abbreviation ?? trimmed.toUpperCase();
}

function usePlaceSearch(kind: "city" | "address", query: string) {
  const [results, setResults] = useState<PlaceHit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");

  useEffect(() => {
    const text = query.trim();
    if (text.length < PLACES_MIN_QUERY) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus("loading");
      const params = new URLSearchParams({ kind, text });
      fetch(`/api/places?${params}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("search failed");
          return response.json() as Promise<{ results?: PlaceHit[] }>;
        })
        .then((body) => {
          if (controller.signal.aborted) return;
          const next = body.results ?? [];
          setResults(next);
          setStatus(next.length > 0 ? "idle" : "empty");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (controller.signal.aborted) return;
          setResults([]);
          setStatus("error");
        });
    }, PLACES_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [kind, query]);

  return { results, status };
}

function PlaceSuggest({
  kind,
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  selectOnFocus = false,
}: {
  kind: "city" | "address";
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (hit: PlaceHit) => void;
  selectOnFocus?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const { results, status } = usePlaceSearch(kind, open ? value : "");
  const emptyText = kind === "city" ? "No cities match." : "No addresses match.";

  useEffect(() => {
    setActive(0);
  }, [results]);

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setBox({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, value, results, status]);

  function choose(hit: PlaceHit) {
    onSelect(hit);
    setOpen(false);
  }

  const showList = open && value.trim().length >= PLACES_MIN_QUERY;

  return (
    <div className={labelClass}>
      <span className={labelTextClass}>{label}</span>
      <input
        ref={inputRef}
        className={inputClass}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={(event) => {
          setOpen(true);
          if (selectOnFocus) event.currentTarget.select();
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && showList && results[active]) {
            event.preventDefault();
            choose(results[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && box ? (
        <ul
          id={listId}
          role="listbox"
          className="fixed z-30 max-h-60 overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
          style={{ top: box.top, left: box.left, width: box.width }}
        >
          {status === "loading" ? (
            <li className="px-3 py-2 text-sm text-muted">Searching…</li>
          ) : null}
          {status === "empty" ? (
            <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>
          ) : null}
          {status === "error" ? (
            <li className="px-3 py-2 text-sm text-danger">Address search is unavailable.</li>
          ) : null}
          {results.map((hit, index) => (
            <li key={hit.id} role="option" aria-selected={index === active}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm ${index === active ? "bg-paper" : "hover:bg-paper"}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(hit)}
              >
                {hit.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PlacesCredit() {
  return (
    <p className="text-xs text-muted">
      Address data ©{" "}
      <a href={GEOAPIFY_ATTRIBUTION_HREF} target="_blank" rel="noreferrer" className="underline">
        Geoapify
      </a>
    </p>
  );
}

/** Search a real address, then keep street, city, state, and ZIP editable. */
export function AddressField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [address, setAddress] = useState<Address>(() => parseAddress(value));
  const [query, setQuery] = useState(value);
  const states = optionsWithCurrent(
    US_STATES.map((state) => state.abbreviation),
    address.state,
  );

  function update(next: Address) {
    setAddress(next);
    const formatted = formatAddress(next);
    setQuery(formatted);
    onChange(formatted);
  }

  return (
    <div className="flex flex-col gap-3">
      <PlaceSuggest
        kind="address"
        label="Headquarters"
        placeholder="Start typing an address"
        value={query}
        onChange={setQuery}
        selectOnFocus
        onSelect={(hit) =>
          update({
            line1: hit.line1,
            city: hit.city,
            state: stateAbbreviation(hit.state),
            postalCode: hit.postalCode,
            country: hit.country,
          })
        }
      />
      <PlacesCredit />
      <label className={labelClass}>
        <span className={labelTextClass}>Street</span>
        <input
          className={inputClass}
          value={address.line1}
          placeholder="Street address"
          onChange={(event) => update({ ...address, line1: event.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          <span className={labelTextClass}>City</span>
          <input
            className={inputClass}
            value={address.city}
            placeholder="City"
            onChange={(event) => update({ ...address, city: event.target.value })}
          />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>State</span>
          <select
            className={inputClass}
            value={address.state}
            onChange={(event) => update({ ...address, state: event.target.value })}
          >
            <option value="">Select a state</option>
            {states.map((abbreviation) => {
              const named = US_STATES.find((state) => state.abbreviation === abbreviation);
              return (
                <option key={abbreviation} value={abbreviation}>
                  {named?.name ?? abbreviation}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          <span className={labelTextClass}>Postal code</span>
          <input
            className={inputClass}
            value={address.postalCode}
            placeholder="ZIP code"
            onChange={(event) => update({ ...address, postalCode: event.target.value })}
          />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Country</span>
          <input
            className={inputClass}
            value={address.country}
            placeholder="Country"
            onChange={(event) => update({ ...address, country: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

/** City search. Each pick becomes an office chip. */
export function OfficesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = splitLocations(value);
  const [query, setQuery] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <PlaceSuggest
        kind="city"
        label="Offices"
        placeholder="Search cities"
        value={query}
        onChange={setQuery}
        onSelect={(hit) => {
          const city = hit.label.trim();
          setQuery("");
          if (!city || selected.some((item) => item.toLowerCase() === city.toLowerCase())) return;
          onChange(joinLocations([...selected, city]));
        }}
      />
      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((city) => (
            <button
              key={city}
              type="button"
              className="rounded-md bg-paper px-2 py-0.5 text-sm text-ink hover:text-danger"
              aria-label={`Remove ${city}`}
              onClick={() => onChange(joinLocations(selected.filter((item) => item !== city)))}
            >
              {city} ×
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">
          Search for a city and pick it. Add as many offices as you need.
        </p>
      )}
      <PlacesCredit />
    </div>
  );
}

function optionsWithCurrent(options: string[], current: string) {
  if (!current || options.includes(current)) return options;
  return [current, ...options];
}
