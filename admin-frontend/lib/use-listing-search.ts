"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { listingHref, listingUrlChange } from "@/lib/listing";

/**
 * List filters and pages live in React state. The address bar is updated with
 * the platform history method so Next.js does not treat it as a navigation.
 * Next patches `window.history.replaceState` and restores the dynamic console
 * layout, which refetches the staff shell on every page click.
 */
export function useListingSearch(path?: string) {
  const pathname = usePathname();
  const base = path ?? pathname;
  const initial = useSearchParams();
  const [query, setQuery] = useState(() => initial.toString());

  useEffect(() => {
    const sync = () => setQuery(window.location.search.replace(/^\?/, ""));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const searchParams = useMemo(() => new URLSearchParams(query), [query]);

  const commit = useCallback(
    (href: string) => {
      const next = href.startsWith("?") ? `${base}${href}` : href;
      const target = listingUrlChange(
        { pathname: window.location.pathname, search: window.location.search },
        next,
      );
      if (target !== null) {
        History.prototype.replaceState.call(window.history, window.history.state, "", target);
      }
      const search = next.includes("?") ? next.slice(next.indexOf("?") + 1) : "";
      setQuery(search);
    },
    [base],
  );

  const replace = useCallback(
    (values: Record<string, string | number | null>) => {
      commit(listingHref(base, searchParams, values));
    },
    [base, commit, searchParams],
  );

  return { searchParams, replace, commit };
}
