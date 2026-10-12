"use client";

import { HStack, Pagination, Text } from "sid-ui";
import { formatCount } from "@/lib/format";

/** Offset pagination. The parent updates the list in place; this does not navigate. */
export function UrlPager({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
      <Text type="supporting" color="secondary">
        {formatCount(start)}–{formatCount(end)} of {formatCount(total)}
      </Text>
      {total > pageSize ? (
        <Pagination
          page={page}
          totalItems={total}
          pageSize={pageSize}
          onChange={onPageChange}
          size="sm"
        />
      ) : null}
    </HStack>
  );
}
