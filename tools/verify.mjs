// Post-push sanity check: confirm the repo has no secrets and the expected files are there.
// Usage: node tools/verify.mjs
const OWNER = "CrayonShinwo";
const REPO = "metal-material-calculator";
const SITE = "https://crayonshinwo.github.io/metal-material-calculator";

const FORBIDDEN = /(\.keystore$|\.jks$|\.p12$|signing[^/]*\.json$|签名信息|password|secret|token)/i;

// 带上 token 可以避免 api.github.com 的匿名限流（每 IP 每小时 60 次）
const TOKEN = process.env.GH_TOKEN;
const apiHeaders = { Accept: "application/vnd.github+json", "User-Agent": "dsh-metal-calc-verify" };
if (TOKEN) apiHeaders.Authorization = `Bearer ${TOKEN}`;

const treeRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/main?recursive=1`, {
  headers: apiHeaders
});
if (!treeRes.ok) {
  throw new Error(
    `GitHub API 返回 HTTP ${treeRes.status}。` +
      (treeRes.status === 403 || treeRes.status === 429
        ? "这是匿名请求限流（每 IP 每小时 60 次）；设置 GH_TOKEN 后再运行即可。"
        : "")
  );
}
const tree = await treeRes.json();
if (!Array.isArray(tree.tree)) throw new Error(`GitHub API 返回了意外内容: ${JSON.stringify(tree).slice(0, 200)}`);
const paths = tree.tree.filter((t) => t.type === "blob").map((t) => t.path).sort();

console.log(`repo has ${paths.length} files:\n`);
for (const p of paths) {
  const f = tree.tree.find((t) => t.path === p);
  console.log(`  ${p.padEnd(48)} ${String(f.size).padStart(9)}`);
}

const leaks = paths.filter((p) => FORBIDDEN.test(p));
console.log(leaks.length ? `\n!! SECRET-LOOKING FILES IN REPO: ${leaks.join(", ")}` : "\nno secret-looking files in the repo  ✓");

const needed = [
  "index.html",
  "manifest.json",
  "sw.js",
  "download.html",
  "js/install.js",
  "css/install.css",
  "assets/icon-maskable-512.png",
  "assets/icon-maskable-192.png",
  "download/metal-material-calculator.apk",
  "download/metal-material-calculator.aab",
  "ANDROID.md",
  "tools/README.md",
  "tools/pull.mjs",
  "tools/push.mjs",
  "tools/build-apk.mjs",
  "tools/assetlinks.mjs",
  "tools/unzip.mjs",
  "tools/verify.mjs",
  "tools/test-routing.mjs"
];
let missing = 0;
console.log("expected files:");
for (const n of needed) {
  const ok = paths.includes(n);
  if (!ok) missing++;
  console.log(`  ${ok ? "ok     " : "MISSING"} ${n}`);
}

// the site must be serving the real thing (Pages rebuild takes a few minutes)
console.log("\nwaiting for the new Pages build ...");
let dlHtml = "";
for (let i = 0; i < 75; i++) {
  try {
    const res = await fetch(`${SITE}/download.html`, { cache: "no-store" });
    if (res.ok) { dlHtml = await res.text(); break; }
    process.stdout.write(`.${res.status}`);
  } catch { process.stdout.write("x"); }
  await new Promise((r) => setTimeout(r, 8000));
}
console.log("");
if (!dlHtml) console.log("!! download.html never went live");
const dlOk = dlHtml.includes("download/metal-material-calculator.apk") && !dlHtml.includes("<script");
console.log(`live download.html: served=${!!dlHtml}  links APK=${dlHtml.includes("download/metal-material-calculator.apk")}  has NO <script>=${!dlHtml.includes("<script")}`);

const liveHtml = await (await fetch(`${SITE}/index.html`, { cache: "no-store" })).text();
const liveOk = liveHtml.includes("download/metal-material-calculator.apk") && liveHtml.includes("./download.html");
console.log(`live index.html links APK + download page: ${liveOk}`);

const sw = await (await fetch(`${SITE}/sw.js`, { cache: "no-store" })).text();
const v13 = sw.includes("metal-calc-v13") && sw.includes("./download.html");
console.log(`live sw.js is v13 and precaches download.html: ${v13}`);

const bad = leaks.length + missing + (liveOk ? 0 : 1) + (v13 ? 0 : 1) + (dlOk ? 0 : 1);
console.log(bad === 0 ? "\nVERIFY OK" : `\n${bad} problem(s)`);
// exitCode（不是 process.exit）以避免 Node 在 Windows 上退出阶段崩溃
process.exitCode = bad === 0 ? 0 : 1;
