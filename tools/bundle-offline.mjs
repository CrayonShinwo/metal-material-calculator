// 把 site/ 打包成「离线安卓 App」需要的本地资源。
//
// 用法（在项目根目录执行）：
//   node tools/bundle-offline.mjs                 # 生成/刷新 android-app 的本地资源
//   node tools/bundle-offline.mjs --check         # 只检查是否与 site/ 同步（CI 用，不同步则退出码 1）
//   node tools/bundle-offline.mjs --site <dir> --app <dir>   # 自定义目录（本工具自测用）
//
// 产出：
//   android-app/app/src/main/assets/www/**                      ← 页面本体
//   android-app/app/src/main/res/mipmap-xxxhdpi/ic_launcher*.png ← 桌面图标（从 site/assets 复制）
//
// 与 site/ 的差异（只做三件必要的事，任何锚点找不到就直接报错，绝不"悄悄打包出坏版本"）：
//   1. 不打包 download/、download.html、tests/、package.json、README.md、SYSTEM.md
//      —— download/ 里是 1MB 的 APK/AAB，打进 App 里没有意义，还白涨体积。
//   2. 不打包 sw.js（**关键**）：资源已经全在本地，而 WebView 里由 Service Worker 发起的请求
//      不会经过 WebViewAssetLoader 的拦截，会真的去打网络并失败 —— 所以离线版必须没有 SW。
//      app.js 里的 register("./sw.js") 会失败并被它自己的 .catch(() => {}) 静默吞掉。
//   3. index.html 里删掉"安装到手机桌面"卡片和页脚的"下载 APK"入口
//      —— 已经在 App 里了，这些东西只会让人困惑，而且它指向的 `npm download.html` 并不在包里。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ------------------------------------------------------------------ 参数
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : fallback;
}

const SITE = arg("--site", path.join(REPO, "site"));
const APP = arg("--app", path.join(REPO, "android-app"));
const CHECK_ONLY = process.argv.includes("--check");

const WWW = path.join(APP, "app/src/main/assets/www");
const MIPMAP = path.join(APP, "app/src/main/res/mipmap-xxxhdpi");

// ------------------------------------------------------------------ 规则
const SKIP_DIRS = new Set(["download", "tests"]);
const SKIP_FILES = new Set([
  "download.html",
  "sw.js",
  "package.json",
  "README.md",
  "SYSTEM.md",
  ".gitignore"
]);

/** 收集 site/ 下要打包的文件（相对路径用 / 分隔） */
function collectSiteFiles(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...collectSiteFiles(path.join(dir, entry.name), rel));
    } else {
      if (SKIP_FILES.has(entry.name)) continue;
      out.push(rel);
    }
  }
  return out;
}

/** 若 `at` 上方紧邻的是"整行 HTML 注释 + 空白"，返回该注释行的起点，否则原样返回 `at` */
function swallowPrecedingCommentLine(text, at) {
  let end = at;
  while (end > 0 && /[ \t\r\n]/.test(text[end - 1])) end--;
  const lineStart = text.lastIndexOf("\n", end - 1) + 1;
  const line = text.slice(lineStart, end);
  return /^[ \t]*<!--.*-->[ \t]*$/.test(line) ? lineStart : at;
}

/** 按锚点删掉一个完整的 HTML 元素（含它上方的说明注释与空行） */
function removeElement(html, anchor, startMarker, endMarker, label) {
  const at = html.indexOf(anchor);
  if (at < 0) throw new Error(`index.html 里找不到「${label}」：${anchor}`);
  const count = html.split(anchor).length - 1;
  if (count !== 1) throw new Error(`「${label}」应该只有 1 处，实际 ${count} 处`);

  const startAt = html.lastIndexOf(startMarker, at);
  if (startAt < 0) throw new Error(`找不到「${label}」的起点：${startMarker}`);
  const endAt = html.indexOf(endMarker, at);
  if (endAt < 0) throw new Error(`找不到「${label}」的终点：${endMarker}`);

  const from = swallowPrecedingCommentLine(html, startAt);
  return html.slice(0, from) + html.slice(endAt + endMarker.length);
}

/**
 * 生成离线版的 index.html。
 * 锚点全部写成"找不到 / 数量不对就抛错"，这样 site/index.html 改结构时我们会立刻发现，
 * 而不是打出一个还带着"下载 APK"按钮的奇怪 App。
 */
function transformIndex(html) {
  // ① 整块删掉安装引导卡片（js/install.js 发现卡片不存在会直接 return，不再显示任何安装引导）
  let out = removeElement(html, 'id="install-card"', "<section", "</section>", "安装引导卡片");

  // ② 删掉页脚的"下载 APK"入口（卡片删掉后，这段应当只剩一处）
  out = removeElement(out, '<p class="install-download">', '<p class="install-download">', "</p>", "页脚下载入口");

  // ③ 收敛空行
  return out.replace(/\n{3,}/g, "\n\n");
}

// ------------------------------------------------------------------ 生成
function build() {
  if (!fs.existsSync(path.join(SITE, "index.html"))) {
    throw new Error(`在 ${SITE} 里找不到 index.html —— 先用 node tools/pull.mjs 拉取网站文件`);
  }

  const files = new Map(); // 目标相对 android-app 的路径 -> Buffer
  const rel = (p) => path.relative(APP, p).split(path.sep).join("/");

  for (const r of collectSiteFiles(SITE)) {
    const buf = fs.readFileSync(path.join(SITE, r));
    files.set(`${rel(WWW)}/${r}`, r === "index.html" ? Buffer.from(transformIndex(buf.toString("utf8")), "utf8") : buf);
  }

  const icons = [
    ["icon-512.png", "ic_launcher.png"],
    ["icon-512.png", "ic_launcher_round.png"],
    ["icon-maskable-512.png", "ic_launcher_foreground.png"]
  ];
  for (const [from, to] of icons) {
    const src = path.join(SITE, "assets", from);
    if (!fs.existsSync(src)) throw new Error(`图标不存在：${src}`);
    files.set(`${rel(MIPMAP)}/${to}`, fs.readFileSync(src));
  }

  return files;
}

function writeAll(files) {
  // 先清掉整个 www，避免上一次生成、这次已删除的文件残留在包里
  fs.rmSync(WWW, { recursive: true, force: true });
  fs.mkdirSync(MIPMAP, { recursive: true });
  for (const [relPath, buf] of files) {
    const full = path.join(APP, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buf);
  }
}

/** --check：把期望内容和磁盘上的实际内容比一遍 */
function check(files) {
  const problems = [];
  const onDisk = new Set();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else onDisk.add(relPathOf(full));
    }
  };
  const relPathOf = (full) => path.relative(APP, full).split(path.sep).join("/");
  walk(path.join(APP, "app/src/main/assets/www"));
  walk(MIPMAP);

  for (const [relPath, buf] of files) {
    const full = path.join(APP, relPath);
    if (!fs.existsSync(full)) problems.push(`缺失：${relPath}`);
    else if (!fs.readFileSync(full).equals(buf)) problems.push(`内容不一致：${relPath}`);
    onDisk.delete(relPath);
  }
  for (const extra of onDisk) problems.push(`多余：${extra}`);

  if (problems.length) {
    console.error("!! 离线资源与 site/ 不同步，请运行 node tools/bundle-offline.mjs");
    for (const p of problems) console.error("   - " + p);
    process.exit(1);
  }
  console.log(`离线资源已同步（${files.size} 个文件）`);
}

// ------------------------------------------------------------------ main
const files = build();

if (CHECK_ONLY) {
  check(files);
} else {
  writeAll(files);
  let bytes = 0;
  for (const buf of files.values()) bytes += buf.length;
  const wwwCount = [...files.keys()].filter((k) => k.includes("/assets/www/")).length;
  console.log(`已生成离线资源：${SITE}`);
  console.log(`  → ${path.relative(REPO, WWW) || WWW}   ${wwwCount} 个文件`);
  console.log(`  → ${path.relative(REPO, MIPMAP) || MIPMAP}   ${files.size - wwwCount} 个图标`);
  console.log(`  合计 ${(bytes / 1024).toFixed(1)} KB`);
  console.log("  已排除：download/ download.html sw.js tests/ package.json README.md SYSTEM.md");
  console.log("  已改写：index.html（移除安装引导卡片与页脚下载入口）");
}
