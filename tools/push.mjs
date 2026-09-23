// Push site/ + tools/ + android-app/ + ANDROID.md + the built APK/AAB to the GitHub repo in ONE commit.
// Everything goes through api.github.com (github.com itself may be blocked on some networks).
//
// Usage (run from the project root):
//   node tools/push.mjs --dry-run        # 只列出会被上传的文件（不联网、不需要 token）★ 推荐先跑这个
//   node tools/push.mjs <token>          # 或先 export GH_TOKEN=...
import fs from "node:fs";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
const TOKEN = process.env.GH_TOKEN || process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!TOKEN && !DRY_RUN) { console.error("usage: node tools/push.mjs <token>   |   node tools/push.mjs --dry-run"); process.exit(1); }

const OWNER = "CrayonShinwo";
const REPO = "metal-material-calculator";
const BRANCH = "main";
const API = "https://api.github.com";

// belt-and-braces: never publish anything that looks like a secret
const FORBIDDEN = /(\.keystore$|\.jks$|\.p12$|signing[^/]*\.json$|签名信息|password|secret|token)/i;

// never publish build outputs / IDE state
const SKIP_DIRS = /(^|\/)(\.gradle|\.idea|build|node_modules|captures)(\/|$)/;

const files = new Map();
let skipped = 0;
function add(rel, buf) {
  if (FORBIDDEN.test(rel)) { console.log(`  !! refused to upload secret-looking path: ${rel}`); skipped++; return; }
  files.set(rel, buf);
}
function walk(dir, prefix = "") {
  if (!fs.existsSync(dir)) return false;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.test(rel)) continue;
      walk(full, rel);
    } else {
      add(rel, fs.readFileSync(full));
    }
  }
  return true;
}

console.log("collecting files ...");
if (!walk("site")) { console.error("\nsite/ not found - run `node tools/pull.mjs` first."); process.exit(2); }
walk("tools", "tools");
// 安卓离线工程（含已生成的 assets/www 与图标，克隆下来即可直接出包）
if (!walk("android-app", "android-app")) {
  console.log("  (android-app/ not found - skipped)");
}
if (fs.existsSync("ANDROID.md")) add("ANDROID.md", fs.readFileSync("ANDROID.md"));

const REL = "release";
const newest = (ext) =>
  fs.existsSync(REL)
    ? fs.readdirSync(REL).filter((f) => f.toLowerCase().endsWith(ext))
        .map((f) => ({ f, t: fs.statSync(path.join(REL, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t)[0]?.f
    : null;
for (const [ext, dest] of [[".apk", "download/metal-material-calculator.apk"], [".aab", "download/metal-material-calculator.aab"]]) {
  const n = newest(ext);
  if (n) add(dest, fs.readFileSync(path.join(REL, n)));
}
console.log(`${files.size} files to upload${skipped ? `, ${skipped} secret(s) refused` : ""}`);

// ------------------------------------------------------------------ dry run
if (DRY_RUN) {
  let bytes = 0;
  console.log("\n--dry-run：以下文件会被上传（没有联网、没有上传）");
  for (const [rel, buf] of [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    bytes += buf.length;
    console.log(`  ${rel.padEnd(58)} ${String(buf.length).padStart(9)}`);
  }
  console.log(`\n合计 ${files.size} 个文件 / ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`release/ 只会上传最新的 APK/AAB 到 download/，密钥与密码文件不会被读取，也不会上传。`);
  process.exit(0);
}

// ------------------------------------------------------------------ upload
async function api(method, endpoint, body) {
  const res = await fetch(API + endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "dsh-metal-calc-push"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { ok: res.ok, status: res.status, json, text };
}
const must = (r, what) => { if (!r.ok) throw new Error(`${what} -> HTTP ${r.status}: ${r.json?.message || r.text}`); return r.json; };

const me = must(await api("GET", "/user"), "GET /user");
console.log(`token account: ${me.login}`);
if (me.login.toLowerCase() !== OWNER.toLowerCase()) { console.error(`token must belong to ${OWNER}`); process.exit(3); }

const repo = must(await api("GET", `/repos/${OWNER}/${REPO}`), "GET repo");
if (!repo.permissions?.push) { console.error("no push permission"); process.exit(3); }

const ref = await api("GET", `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
const parents = ref.ok ? [ref.json.object.sha] : [];
const baseTree = ref.ok
  ? must(await api("GET", `/repos/${OWNER}/${REPO}/git/commits/${ref.json.object.sha}`), "GET commit").tree.sha
  : null;

const entries = [];
for (const [rel, buf] of [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const blob = must(await api("POST", `/repos/${OWNER}/${REPO}/git/blobs`, { content: buf.toString("base64"), encoding: "base64" }), `blob ${rel}`);
  entries.push({ path: rel, mode: "100644", type: "blob", sha: blob.sha });
  console.log(`  ${rel.padEnd(46)} ${String(buf.length).padStart(9)} bytes`);
}

const treeBody = { tree: entries };
if (baseTree) treeBody.base_tree = baseTree;
const tree = must(await api("POST", `/repos/${OWNER}/${REPO}/git/trees`, treeBody), "POST tree");
const commit = must(
  await api("POST", `/repos/${OWNER}/${REPO}/git/commits`, {
    message: "chore: 同步网站、工具链、安卓离线工程与安装说明",
    tree: tree.sha,
    parents
  }),
  "POST commit"
);
if (ref.ok) must(await api("PATCH", `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha }), "PATCH ref");
else must(await api("POST", `/repos/${OWNER}/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commit.sha }), "POST ref");

console.log(`\npushed ${commit.sha}`);
console.log(`https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`);
console.log("GitHub Pages will rebuild in ~1-6 minutes.");
