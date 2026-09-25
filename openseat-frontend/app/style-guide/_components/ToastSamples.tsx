"use client";

import { Button, useToast } from "@/components/ui";

export function ToastSamples() {
  const toast = useToast();

  return (
    <>
      <Button label="Invite sent" onClick={() => toast({ body: "Invite sent to 2 bidders" })} />
      <Button label="Send failed" variant="destructive" onClick={() => toast({ body: "Failed to send — try again", type: "error" })} />
    </>
  );
}
