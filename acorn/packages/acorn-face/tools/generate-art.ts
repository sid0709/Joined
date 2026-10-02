// Generate the acorn rig's source art with the OpenAI Images API.
// Run: bun run --cwd acorn/packages/acorn-face art -- <job> [reference.png]
// Needs OPENAI_API_KEY in acorn/.env (git-ignored). Outputs land in art/raw/ for review.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const API_BASE = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
/** gpt-image-2.5 ships as "flare" and "sunburst" variants. */
const MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-flare";
const OUT = join(import.meta.dir, "..", "art", "raw");
const VARIANTS = 2;

const STYLE =
  "Glossy, soft 3D cartoon style matching the reference: warm tan nut with a smooth satin finish, " +
  "brown scaled cap with rounded overlapping scales, short curled stem. Soft studio light from the top left, " +
  "gentle ambient occlusion under the cap. Transparent background, no ground shadow, no text, no border.";

const JOBS: Record<string, string> = {
  body:
    "Draw the same cute acorn character from the reference, perfectly front-facing and left-right symmetric, " +
    "upright, centered with an even empty margin around it. The face is completely blank: NO eyes, NO mouth, " +
    "NO eyebrows, NO blush, no markings at all, just the smooth glossy nut surface where the face would be. " +
    STYLE,
};

const job = Bun.argv[2];
const reference = Bun.argv[3];
const key = process.env.OPENAI_API_KEY;
if (!job || !JOBS[job])
  throw new Error(`Usage: art <${Object.keys(JOBS).join("|")}> [reference.png]`);
if (!key) throw new Error("OPENAI_API_KEY is missing. Put it in acorn/.env.");

const form = new FormData();
form.set("model", MODEL);
form.set("prompt", JOBS[job]);
form.set("n", String(VARIANTS));
form.set("size", "1024x1024");
form.set("quality", "high");
form.set("background", "transparent");
form.set("output_format", "png");
if (reference) form.set("image", Bun.file(reference));

const endpoint = reference ? "images/edits" : "images/generations";
const res = await fetch(`${API_BASE}/${endpoint}`, {
  method: "POST",
  headers: reference
    ? { Authorization: `Bearer ${key}` }
    : { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: reference ? form : JSON.stringify(Object.fromEntries(form)),
});
const body = await res.json();
if (!res.ok) throw new Error(`${res.status}: ${body.error?.message ?? JSON.stringify(body)}`);

await mkdir(OUT, { recursive: true });
const stamp = Date.now();
for (const [i, item] of body.data.entries()) {
  const file = join(OUT, `${job}-${stamp}-${i + 1}.png`);
  await Bun.write(file, Buffer.from(item.b64_json, "base64"));
  console.log(file);
}
