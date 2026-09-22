// Download every file of the repo into ./site so it can be edited locally.
// Usage: node tools/pull.mjs
import fs from "node:fs";
import path from "node:path";

const OWNER = "CrayonShinwo";
const REPO = "metal-material-calculator";
const OUT = "site";

const treeRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/main?recursive=1`);
if (!treeRes.ok) { console.error(`tree API HTTP ${treeRes.status}`); process.exit(1); }
const tree = await treeRes.json();
const blobs = tree.tree.filter((t) => t.type === "blob");
console.log(`repo has ${blobs.length} files`);

fs.rmSync(OUT, { recursive: true, force: true });
let failed = 0;

for (const b of blobs) {
  const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${b.path}`;
  let buf = null;
  for (let attempt = 1; attempt <= 3 && !buf; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) buf = Buffer.from(await res.arrayBuffer());
    } catch { /* retry */ }
  }
  if (!buf) { console.error(`  FAILED ${b.path}`); failed++; continue; }
  const dest = path.join(OUT, b.path);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  const sizeOk = buf.length === b.size;
  if (!sizeOk) failed++;
  console.log(`  ${sizeOk ? "ok " : "SIZE"} ${b.path.padEnd(40)} ${String(buf.length).padStart(8)}`);
}

console.log(failed ? `\n${failed} problem(s)` : `\ndownloaded ${blobs.length} files into ${OUT}/`);
process.exit(failed ? 1 : 0);
