import { runFromEnv } from "./run.ts";

const readOnlyFetch: typeof fetch = (input, init) => {
  const method = init?.method ?? "GET";
  if (method !== "GET") {
    return Promise.reject(new Error(`load harness is read-only, refused ${method}`));
  }
  return fetch(input, { ...init, method: "GET" });
};

async function main(): Promise<number> {
  const report = await runFromEnv(process.env, async (url, init) => {
    const response = await readOnlyFetch(url, init);
    return { ok: response.ok, status: response.status };
  });
  for (const line of report.lines) {
    console.log(line);
  }
  return report.exitCode;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
