"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  CommandPalette,
  createStaticSource,
  icons,
  Icon,
  type SearchableItem,
} from "@openseat/design-system";
import { ALL_PAGES } from "@/lib/nav";

const PALETTE_LABEL = "Jump to a page";
const PALETTE_GROUP = "Pages";
const SHORTCUT_HINT = "Ctrl or ⌘ + K";

type PageItem = SearchableItem<{ group: string; description: string }>;

/** ⌘K: a search-and-jump palette over every page, opened from the top bar or the keyboard. */
export function CommandMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const source = useMemo(
    () =>
      createStaticSource<PageItem>(
        ALL_PAGES.map((page) => ({
          id: page.href,
          label: page.label,
          auxiliaryData: { group: PALETTE_GROUP, description: page.description },
        })),
        { keywords: (item) => [item.auxiliaryData?.description ?? ""] },
      ),
    [],
  );

  return (
    <>
      <Button
        label={PALETTE_LABEL}
        variant="ghost"
        size="sm"
        icon={<Icon icon={icons.search} />}
        isIconOnly
        tooltip={`${PALETTE_LABEL} (${SHORTCUT_HINT})`}
        onClick={() => setIsOpen(true)}
      />
      <CommandPalette
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        searchSource={source}
        label={PALETTE_LABEL}
        onValueChange={(href) => {
          setIsOpen(false);
          router.push(href);
        }}
      />
    </>
  );
}
