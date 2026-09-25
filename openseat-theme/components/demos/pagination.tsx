"use client";

import { useState } from "react";
import { Badge, Card, HStack, Pagination, Stack, Text, type PaginationVariant } from "@openseat/design-system";
import { Caption, Examples, Preview } from "./shared";

const TOTAL = 240;
const VARIANTS: PaginationVariant[] = ["pages", "count", "compact", "input", "dots"];
const PAGE_SIZES = [10, 25, 50];
const LOAD_MS = 600;
const ROOMS = Array.from({ length: 47 }, (_, i) => ({ id: i + 1, title: `Room #${1000 + i + 1}`, bids: (i * 7) % 13 }));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PaginationDemo() {
  const [pages, setPages] = useState<Record<PaginationVariant, number>>({ pages: 5, count: 5, compact: 5, input: 5, dots: 2, none: 1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [feed, setFeed] = useState(1);
  const [loaded, setLoaded] = useState(1);
  const [small, setSmall] = useState(3);

  const start = (page - 1) * pageSize;
  const visible = ROOMS.slice(start, start + pageSize);

  return (
    <Examples>
      <Preview label="Variants" description="pages for tables, count for tight bars, compact for mobile, input for huge sets, dots for carousels.">
        <Stack gap={4}>
          {VARIANTS.map((variant) => (
            <HStack key={variant} gap={4} vAlign="center" wrap="wrap">
              <Stack width={80}>
                <Caption>{variant}</Caption>
              </Stack>
              <Pagination
                variant={variant}
                page={pages[variant]}
                onChange={(p) => setPages((c) => ({ ...c, [variant]: p }))}
                totalPages={variant === "dots" ? 5 : 24}
              />
            </HStack>
          ))}
        </Stack>
      </Preview>

      <Preview label="First, last, and siblings" description="hasFirstLast adds jump buttons; siblingCount widens the window around the current page.">
        <Stack gap={3}>
          <Pagination page={pages.pages} onChange={(p) => setPages((c) => ({ ...c, pages: p }))} totalItems={TOTAL} pageSize={10} hasFirstLast />
          <Pagination page={pages.pages} onChange={(p) => setPages((c) => ({ ...c, pages: p }))} totalItems={TOTAL} pageSize={10} siblingCount={2} />
        </Stack>
      </Preview>

      <Preview label="Sizes">
        <Stack gap={3}>
          <Pagination size="sm" page={small} onChange={setSmall} totalPages={10} />
          <Pagination size="md" page={small} onChange={setSmall} totalPages={10} />
        </Stack>
      </Preview>

      <Preview label="Paged list with page size" description="pageSizeOptions lets people choose how many rows they see.">
        <Card>
          <Stack gap={3}>
            {visible.map((room) => (
              <HStack key={room.id} hAlign="between">
                <Text>{room.title}</Text>
                <Badge label={`${room.bids} bids`} variant={room.bids ? "info" : "neutral"} />
              </HStack>
            ))}
            <Pagination
              page={page}
              onChange={setPage}
              totalItems={ROOMS.length}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZES}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </Stack>
        </Card>
      </Preview>

      <Preview label="Unknown total" description="hasMore for feeds where the end isn’t known; changeAction shows loading while the next page fetches.">
        <Stack gap={2}>
          <Pagination
            page={feed}
            onChange={setFeed}
            hasMore={loaded < 6}
            changeAction={async (p) => {
              await wait(LOAD_MS);
              setFeed(p);
              setLoaded((l) => Math.max(l, p));
            }}
          />
          <Caption>Page {feed} · the feed ends after page 6</Caption>
        </Stack>
      </Preview>

      <Preview label="Disabled" description="While the list is refreshing.">
        <Pagination page={3} onChange={() => undefined} totalPages={12} isDisabled />
      </Preview>
    </Examples>
  );
}
