// Publish .well-known/assetlinks.json to the user-site repo so the TWA runs
// without a URL bar. Re-run whenever the signing key / fingerprint changes.
//
// Usage (run from the project root):  node tools/assetlinks.mjs <token> [packageDir]
import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.GH_TOKEN || process.argv[2];
const SCAN = process.argv[3] || path.join("release", "package");
if (!TOKEN) { console.error("usage: node tools/assetlinks.mjs <token> [packageDir]"); process.exit(1); }

const OWNER = "CrayonShinwo";
const REPO = `${OWNER}.github.io`;
const API = "https://api.github.com";
const LIVE = `https://${OWNER.toLowerCase()}.github.io/.well-known/assetlinks.json`;

async function api(method, endpoint, body) {
  const res = await fetch(API + endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "dsh-metal-calc-assetlinks"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { ok: res.ok, status: res.status, json, text };
}

function find(dir) {
  let hit = null;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === "assetlinks.json") hit = full;
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return hit;
}

const found = find(SCAN);
if (!found) {
  console.error(`no assetlinks.json under "${SCAN}"`);
  console.error("run tools/build-apk.mjs first, or pass the extracted package dir");
  process.exit(2);
}
const parsed = JSON.parse(fs.readFileSync(found, "utf8"));
console.log(`using ${found}`);
for (const e of parsed) {
  console.log(`  package: ${e.target?.package_name}`);
  for (const fp of e.target?.sha256_cert_fingerprints || []) console.log(`  sha256 : ${fp}`);
}
const content = JSON.stringify(parsed, null, 2);
fs.mkdirSync("release", { recursive: true });
fs.writeFileSync(path.join("release", "assetlinks.json"), content);

const repoRes = await api("GET", `/repos/${OWNER}/${REPO}`);
if (repoRes.status === 404) {
  console.log(`creating ${OWNER}/${REPO} ...`);
  const created = await api("POST", "/user/repos", {
    name: REPO,
    description: "GitHub Pages user site (hosts .well-known/assetlinks.json)",
    private: false,
    auto_init: true,
    has_issues: false,
    has_wiki: false,
    has_projects: false
  });
  if (!created.ok) { console.error(`create failed: ${created.json?.message || created.text}`); process.exit(3); }
  await new Promise((r) => setTimeout(r, 4000));
}

async function putFile(filePath, text, message) {
  const enc = filePath.split("/").map(encodeURIComponent).join("/");
  const existing = await api("GET", `/repos/${OWNER}/${REPO}/contents/${enc}?ref=main`);
  const body = { message, content: Buffer.from(text, "utf8").toString("base64"), branch: "main" };
  if (existing.ok) body.sha = existing.json.sha;
  const put = await api("PUT", `/repos/${OWNER}/${REPO}/contents/${enc}`, body);
  if (!put.ok) { console.error(`put ${filePath} failed: ${put.json?.message || put.text}`); process.exit(4); }
  console.log(`  committed ${filePath}`);
}

await putFile(".nojekyll", "\n", "chore: add .nojekyll so .well-known is published");
await putFile(".well-known/assetlinks.json", content, "feat: update Digital Asset Links");

const pages = await api("GET", `/repos/${OWNER}/${REPO}/pages`);
if (!pages.ok) {
  const created = await api("POST", `/repos/${OWNER}/${REPO}/pages`, { source: { branch: "main", path: "/" } });
  if (created.ok || created.status === 409) console.log("pages enabled");
  else { console.error(`enable pages failed: ${created.json?.message || created.text}`); process.exit(5); }
}

console.log(`\nwaiting for ${LIVE} ...`);
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 10000));
  try {
    const res = await fetch(LIVE, { cache: "no-store" });
    if (res.ok) {
      console.log(`LIVE after ~${(i + 1) * 10}s:`);
      console.log(JSON.stringify(JSON.parse(await res.text()), null, 2));
      process.exit(0);
    }
    process.stdout.write(`.${res.status}`);
  } catch { process.stdout.write("x"); }
}
console.error("\nnot reachable yet - check again in a minute");
process.exit(6);
