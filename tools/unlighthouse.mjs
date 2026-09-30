import { runUnlighthouse } from "./unlighthouse-run.mjs";

const code = await runUnlighthouse(process.argv.slice(2));
process.exit(code);
