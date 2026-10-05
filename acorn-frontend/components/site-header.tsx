import { BrandHeading, Button, HStack } from "sid-ui";
import { BRAND } from "@/lib/config";
import { ROUTES } from "@/lib/routes";

/** The signed-out bar on the landing and auth pages. Signed-in pages use AcornHeader. */
export function SiteHeader({ hasSignIn = false }: { hasSignIn?: boolean }) {
  return (
    <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
      <BrandHeading product={BRAND} headingHref={ROUTES.home} />
      {hasSignIn ? <Button label="Sign in" variant="ghost" size="sm" href={ROUTES.signIn} /> : null}
    </HStack>
  );
}
