import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

import pkg from "../package.json" with { type: "json" };

const ZIP_VERSION = 20;
const COMPRESSION_DEFLATE = 8;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIR_SIGNATURE = 0x06054b50;

const CRC_TABLE = buildCrcTable();

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(rootDir, "../dist");
const releaseDir = path.resolve(rootDir, "../release");
const zipName = `scout-${pkg.version}.zip`;
const zipPath = path.join(releaseDir, zipName);

interface ZipEntry {
  name: string;
  data: Buffer;
  compressed: Buffer;
  crc: number;
  dosDateTime: number;
}

mkdirSync(releaseDir, { recursive: true });

const entries = collectFiles(distDir).map((filePath) => {
  const data = readFileSync(filePath);
  const name = toZipPath(path.relative(distDir, filePath));
  return {
    name,
    data,
    compressed: deflateRawSync(data),
    crc: crc32(data),
    dosDateTime: toDosDateTime(statSync(filePath).mtime),
  } satisfies ZipEntry;
});

if (entries.length === 0) {
  throw new Error(`nothing to zip in ${distDir}`);
}

if (!entries.some((entry) => entry.name === "manifest.json")) {
  throw new Error("dist/manifest.json must be present at the zip root");
}

writeFileSync(zipPath, buildZip(entries));
console.log(`Wrote ${path.relative(path.resolve(rootDir, "../.."), zipPath)}`);

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

function toZipPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function buildZip(files: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf8");
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_HEADER_SIGNATURE, 0);
    localHeader.writeUInt16LE(ZIP_VERSION, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(COMPRESSION_DEFLATE, 8);
    localHeader.writeUInt32LE(file.dosDateTime, 10);
    localHeader.writeUInt32LE(file.crc, 14);
    localHeader.writeUInt32LE(file.compressed.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localFile = Buffer.concat([localHeader, nameBytes, file.compressed]);
    localParts.push(localFile);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(CENTRAL_HEADER_SIGNATURE, 0);
    centralHeader.writeUInt16LE(ZIP_VERSION, 4);
    centralHeader.writeUInt16LE(ZIP_VERSION, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(COMPRESSION_DEFLATE, 10);
    centralHeader.writeUInt32LE(file.dosDateTime, 12);
    centralHeader.writeUInt32LE(file.crc, 16);
    centralHeader.writeUInt32LE(file.compressed.length, 20);
    centralHeader.writeUInt32LE(file.data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(Buffer.concat([centralHeader, nameBytes]));
    offset += localFile.length;
  }

  const localSection = Buffer.concat(localParts);
  const centralSection = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIR_SIGNATURE, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSection.length, 12);
  end.writeUInt32LE(localSection.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localSection, centralSection, end]);
}

function toDosDateTime(date: Date): number {
  const year = Math.max(date.getFullYear(), 1980);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  return ((dosDate << 16) | dosTime) >>> 0;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}
