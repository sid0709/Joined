"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HStack, Pagination, Text } from "@joined/design-system";
import { formatCount } from "@/lib/format";

/** Offset pagination bound to the ?page= query value. */
export function UrlPager({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const go = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next > 1) params.set("page", String(next));
    else params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };
  return (
    <HStack hAlign="between" vAlign="center" gap={3} wrap="wrap">
      <Text type="supporting" color="secondary">
        {formatCount(start)}–{formatCount(end)} of {formatCount(total)}
      </Text>
      {total > pageSize ? (
        <Pagination page={page} totalItems={total} pageSize={pageSize} onChange={go} size="sm" />
      ) : null}
    </HStack>
  );
}
