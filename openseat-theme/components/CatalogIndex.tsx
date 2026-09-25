import { Heading, List, ListItem, Stack, Text } from "@openseat/design-system";
import { ClientOnly } from "@/components/ClientOnly";
import { CATALOG, itemHref, type CatalogGroup } from "@/lib/catalog";

function CategoryFallback({ group }: { group: CatalogGroup }) {
  return (
    <Stack gap={3}>
      {group.items.map((item) => (
        <Stack key={item.slug} gap={0}>
          <Text type="label">{item.title}</Text>
          <Text type="supporting" color="secondary" display="block">
            {item.description}
          </Text>
        </Stack>
      ))}
    </Stack>
  );
}

function CategoryList({ group }: { group: CatalogGroup }) {
  return (
    <Stack gap={3}>
      <Heading level={2}>{group.category}</Heading>
      {/* Links mount client-side so browser extensions cannot inject attrs before hydrate. */}
      <ClientOnly fallback={<CategoryFallback group={group} />}>
        <List>
          {group.items.map((item) => (
            <ListItem
              key={item.slug}
              label={item.title}
              description={item.description}
              href={itemHref(item.slug)}
            />
          ))}
        </List>
      </ClientOnly>
    </Stack>
  );
}

export function CatalogIndex() {
  return (
    <Stack gap={8}>
      <Stack gap={2}>
        <Heading level={1}>Browse the library</Heading>
        <Text color="secondary" display="block">
          Every component from @openseat/design-system — original Astryx with the OpenSeat theme. Open a component to see
          live examples.
        </Text>
      </Stack>
      {CATALOG.map((group) => (
        <CategoryList key={group.category} group={group} />
      ))}
    </Stack>
  );
}
