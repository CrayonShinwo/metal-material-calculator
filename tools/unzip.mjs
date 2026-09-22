// Minimal ZIP extractor (stored + deflate + zip64 sizes), so the toolchain needs no
// external unzip tool. Usage: node tools/unzip.mjs <zip> <destDir>
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export function extractZip(zipPath, destDir) {
  const buf = fs.readFileSync(zipPath);
  // locate End Of Central Directory
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip file (no EOCD)");

  let count = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);
  let cdSize = buf.readUInt32LE(eocd + 12);

  // zip64 fallback
  if (cdOffset === 0xffffffff || count === 0xffff) {
    for (let i = eocd - 20; i >= 0; i--) {
      if (buf.readUInt32LE(i) === 0x07064b50) {
        const z64 = Number(buf.readBigUInt64LE(i + 8));
        count = Number(buf.readBigUInt64LE(z64 + 32));
        cdSize = Number(buf.readBigUInt64LE(z64 + 40));
        cdOffset = Number(buf.readBigUInt64LE(z64 + 48));
        break;
      }
    }
  }

  const written = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/")) continue;

    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    const data = method === 0 ? raw : zlib.inflateRawSync(raw);

    const dest = path.join(destDir, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
    written.push(name);
  }
  return written;
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/unzip.mjs");
if (isMain) {
  const [, , zip, dest] = process.argv;
  if (!zip || !dest) { console.error("usage: node tools/unzip.mjs <zip> <destDir>"); process.exit(1); }
  const files = extractZip(zip, dest);
  console.log(`extracted ${files.length} files:`);
  for (const f of files) console.log(`  ${f}`);
}
