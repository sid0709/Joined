import { Button, HStack, Text } from "@joined/design-system";
import { ROUTES } from "@/lib/nav";
import type { Staff } from "@/lib/staff-session";

/** The signed-in staff member and a way out. Sign-out posts, so nothing prefetches it. */
export function StaffMenu({ staff }: { staff: Staff }) {
  return (
    <HStack gap={2} vAlign="center">
      <Text type="supporting" color="secondary">
        {staff.email}
      </Text>
      <form method="post" action={ROUTES.signOut}>
        <Button type="submit" label="Sign out" variant="ghost" size="sm" />
      </form>
    </HStack>
  );
}
