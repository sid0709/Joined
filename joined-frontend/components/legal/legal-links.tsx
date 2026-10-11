import { HStack, Link } from "sid-ui";
import { LEGAL_LINKS } from "@/lib/legal";
import { ROUTES } from "@/lib/routes";

/** Terms, privacy, cookies, and the status page — the row inside each page footer. */
export function LegalLinks() {
  return (
    <HStack gap={3} wrap="wrap">
      {LEGAL_LINKS.map((link) => (
        <Link key={link.href} href={link.href}>
          {link.label}
        </Link>
      ))}
      <Link href={ROUTES.status}>Status</Link>
    </HStack>
  );
}
