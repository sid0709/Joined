import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Heading, Stack, Text } from "@openseat/design-system";
import { COMPONENT_ITEMS, findItem } from "@/lib/catalog";
import { ComponentDocs } from "@/components/ComponentDocs";

export function generateStaticParams() {
  return COMPONENT_ITEMS.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = findItem(slug);
  return {
    title: item ? `${item.title} · OpenSeat` : "OpenSeat",
    description: item?.description,
  };
}

export default async function ComponentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = findItem(slug);
  if (!item || item.slug === "tokens") notFound();

  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <Heading level={1}>{item.title}</Heading>
        <Text color="secondary" display="block">
          {item.description}
        </Text>
      </Stack>
      <ComponentDocs slug={item.slug} importName={item.importName} />
    </Stack>
  );
}
