"use client";

import { useState, useSyncExternalStore } from "react";
import { TextInput } from "@/components/ui";

const noopSubscribe = () => () => {};

/** Astryx field status styles differ between server and client, so render it after hydration. */
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function InputSamples() {
  const hydrated = useHydrated();
  const [start, setStart] = useState("");
  const [rate, setRate] = useState("0");
  const invalid = Number(rate) <= 0;

  return (
    <>
      <TextInput label="When can you start" placeholder="e.g. Next Monday" value={start} onChange={setStart} />
      <TextInput
        label="Your rate"
        value={rate}
        onChange={setRate}
        status={hydrated && invalid ? { type: "error", message: "Enter an amount greater than $0" } : undefined}
      />
    </>
  );
}
