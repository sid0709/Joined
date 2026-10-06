import { BrandFooter, HStack, Link, Stack } from "sid-ui";
import { BRAND } from "@/lib/config";
import { SCOUT_LEGAL_LINKS } from "@/lib/routes";

/** Legal drafts beside the brand sign-off. BrandFooter has no link slot. */
export function SiteFooter() {
  return (
    <Stack gap={3}>
      <HStack gap={3} wrap="wrap">
        {SCOUT_LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </HStack>
      <BrandFooter lead={`${BRAND} is part of`} />
    </Stack>
  );
}
