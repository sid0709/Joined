"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@joined/design-system";
import { signOut } from "@/lib/auth/actions";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      label="Sign out"
      variant="secondary"
      size="sm"
      isLoading={pending}
      isDisabled={pending}
      onClick={() => {
        setPending(true);
        void signOut().then(() => {
          router.refresh();
          setPending(false);
        });
      }}
    />
  );
}
