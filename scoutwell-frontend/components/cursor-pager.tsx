import { Button, HStack } from "@joined/design-system";

/** Next/first links for cursor pagination: the API only moves forward. */
export function CursorPager({
  basePath,
  params,
  nextCursor,
  hasCursor,
}: {
  basePath: string;
  params: Record<string, string>;
  nextCursor: string;
  hasCursor: boolean;
}) {
  if (!nextCursor && !hasCursor) return null;
  const href = (cursor?: string) => {
    const search = new URLSearchParams(params);
    if (cursor) search.set("cursor", cursor);
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  return (
    <HStack gap={2} hAlign="end">
      {hasCursor ? <Button label="Back to newest" variant="ghost" size="sm" href={href()} /> : null}
      {nextCursor ? (
        <Button label="Older" variant="secondary" size="sm" href={href(nextCursor)} />
      ) : null}
    </HStack>
  );
}
