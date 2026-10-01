// Copies the Joined app icon (Joined-Logo/3-App-Icon-D-Link) into every Next.js app as the
// file-convention icons Next serves: app/favicon.ico, app/icon.svg, and app/apple-icon.png.
//
//   bun run brand:icons
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { LOCAL_SERVICES } from "./local-services.mjs";
import { repoRoot } from "./workspaces.mjs";

const ICON_DIR = path.join(repoRoot, "Joined-Logo", "3-App-Icon-D-Link");
const png = (size) => path.join(ICON_DIR, "PNG", `joined-icon-link-app-${size}px.png`);

const SVG_SOURCE = path.join(ICON_DIR, "SVG", "joined-icon-link-app.svg");
const APPLE_ICON_SIZE = 180;
/** Sizes packed into favicon.ico. Each entry is stored as PNG, which every current browser reads. */
const FAVICON_SIZES = [32, 64];

const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;
const ICO_TYPE_ICON = 1;
const ICO_BITS_PER_PIXEL = 32;
/** ICO stores 256 as 0 in its one-byte width and height fields. */
const icoDimension = (size) => (size >= 256 ? 0 : size);

/** Wraps PNG images in an ICO container (one directory entry per image). */
function toIco(images) {
  const header = Buffer.alloc(ICO_HEADER_BYTES);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(ICO_TYPE_ICON, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = ICO_HEADER_BYTES + ICO_ENTRY_BYTES * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(ICO_ENTRY_BYTES);
    entry.writeUInt8(icoDimension(size), 0);
    entry.writeUInt8(icoDimension(size), 1);
    entry.writeUInt8(0, 2); // no palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(ICO_BITS_PER_PIXEL, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
}

const favicon = toIco(FAVICON_SIZES.map((size) => ({ size, data: readFileSync(png(size)) })));
const svg = readFileSync(SVG_SOURCE);
const appleIcon = readFileSync(png(APPLE_ICON_SIZE));

for (const { workspace } of LOCAL_SERVICES) {
  const appDir = path.join(repoRoot, workspace, "app");
  writeFileSync(path.join(appDir, "favicon.ico"), favicon);
  writeFileSync(path.join(appDir, "icon.svg"), svg);
  writeFileSync(path.join(appDir, "apple-icon.png"), appleIcon);
  console.log(`${workspace}: favicon.ico, icon.svg, apple-icon.png`);
}
