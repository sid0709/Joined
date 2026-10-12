import { describe, expect, test } from "bun:test";

import {
  INGEST_BATCH_MAX_BYTES,
  INGEST_BATCH_MAX_JOBS,
  ingestBodyBytes,
  splitIngestBatches,
  utf8ByteLength,
} from "./ingestBatcher.js";

describe("splitIngestBatches", () => {
  test("packs by the 50-job cap and the 4 MiB body cap", () => {
    const items = Array.from({ length: 51 }, (_, index) => ({ job: { id: index, title: "x" } }));
    const batches = splitIngestBatches(items);
    expect(batches[0]).toHaveLength(INGEST_BATCH_MAX_JOBS);
    expect(batches[1]).toHaveLength(1);
    expect(utf8ByteLength("ab")).toBe(2);
    expect(ingestBodyBytes([{ title: "a" }], "crawler")).toBeGreaterThan(0);

    const huge = { title: "x".repeat(INGEST_BATCH_MAX_BYTES) };
    const split = splitIngestBatches([{ job: huge }, { job: { title: "next" } }], {
      maxBytes: 1_000,
    });
    expect(split).toHaveLength(2);
  });
});
