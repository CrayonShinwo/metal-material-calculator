// Route test for site/js/install.js — the exact bug class we hit:
// UC / 夸克 / 小米 / 华为 / vivo 浏览器 were told "请先用 Chrome 打开",
// even though they can download the APK perfectly well.
//
// Usage: node tools/test-routing.mjs
//        MOD=<url or path> node tools/test-routing.mjs   # test the DEPLOYED file instead
let MOD = process.env.MOD || "../site/js/install.js";

if (MOD.startsWith("http")) {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const code = await (await fetch(MOD, { cache: "no-store" })).text();
  const tmp = path.join(os.tmpdir(), `live-install-${Date.now()}.mjs`);
  fs.writeFileSync(tmp, code);
  MOD = pathToFileURL(tmp).href;
  console.log(`目标：线上文件 ${process.env.MOD} (${code.length} 字符)\n`);
} else {
  console.log(`目标：本地文件 ${MOD}\n`);
}

const ANDROID = (extra) =>
  `Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 ${extra}`;

const cases = [
  // [名称, UA, 期望: "inapp" | "anybrowser" | "ios" | "desktop"]
  ["Chrome (Android)", ANDROID(""), "anybrowser"],
  ["Edge (Android)", ANDROID("EdgA/124.0.2478.62"), "anybrowser"],
  [
    "小米自带浏览器",
    "Mozilla/5.0 (Linux; U; Android 13; zh-cn; 22081212C) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/77.0.3865.120 MQQBrowser/6.2 TBS/045913 Mobile Safari/537.36 XiaoMi/MiuiBrowser/16.2.30",
    "anybrowser"
  ],
  [
    "华为浏览器",
    "Mozilla/5.0 (Linux; Android 12; HarmonyOS) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/13.0.1.302 Mobile Safari/537.36",
    "anybrowser"
  ],
  [
    "vivo 浏览器",
    "Mozilla/5.0 (Linux; Android 13; V2230A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36 VivoBrowser/19.6.0.0",
    "anybrowser"
  ],
  [
    "UC 浏览器",
    "Mozilla/5.0 (Linux; U; Android 12; zh-CN; V2162A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 UCBrowser/16.2.1.1314 Mobile Safari/537.36",
    "anybrowser"
  ],
  [
    "夸克",
    "Mozilla/5.0 (Linux; U; Android 13; zh-CN; 2211133C) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.5481.154 Quark/6.9.5.260 Mobile Safari/537.36",
    "anybrowser"
  ],
  ["Firefox (Android)", "Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0", "anybrowser"],
  ["三星浏览器", ANDROID("SamsungBrowser/25.0"), "anybrowser"],
  // 只有社交 App 内置浏览器才应该被要求"在浏览器打开"
  [
    "微信内置",
    "Mozilla/5.0 (Linux; Android 13; PGT-AN10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0.5304.141 Mobile Safari/537.36 MicroMessenger/8.0.42.2460",
    "inapp"
  ],
  [
    "QQ 内置",
    "Mozilla/5.0 (Linux; Android 13; PGT-AN10) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0.5304.141 Mobile Safari/537.36 QQ/8.9.88.12565",
    "inapp"
  ],
  [
    "iPhone Safari",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "ios"
  ],
  [
    "桌面 Chrome",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "desktop"
  ]
];

function stub(ua) {
  // Node 24 defines some of these as getter-only globals, so define them explicitly.
  const set = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  const nav = { userAgent: ua, maxTouchPoints: 0 };
  set("navigator", nav);
  set("window", {
    navigator: nav,
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    location: { reload() {} }
  });
  set("document", { getElementById: () => null, referrer: "", addEventListener() {} });
}

let failures = 0;
console.log("UA 分流测试\n" + "=".repeat(78));

for (const [i, [name, ua, expect]] of cases.entries()) {
  stub(ua);
  const mod = await import(`${MOD}?case=${i}`); // fresh module per UA (top-level UA read)
  const g = mod.buildGuide();
  const text = `${g.tip || ""} ${(g.steps || []).join(" ")} ${g.note || ""}`;

  let ok = true;
  const problems = [];

  if (g.hide) { ok = false; problems.push("unexpectedly hidden"); }

  if (expect === "anybrowser") {
    // 关键：这类浏览器绝不能被劝去装 Chrome
    if (/请先.*Chrome|先用 Chrome|在 Chrome 中打开本页/.test(text)) {
      ok = false; problems.push('错误地要求用户换 Chrome');
    }
    if (!/不需要 Chrome|任何浏览器|立即安装/.test(text)) {
      ok = false; problems.push("没有说明可用任意浏览器下载");
    }
  }
  if (expect === "inapp") {
    if (!/在浏览器打开/.test(text)) { ok = false; problems.push('缺少"在浏览器打开"指引'); }
  }
  if (expect === "ios") {
    if (!/Safari/.test(text)) { ok = false; problems.push("不是 iOS/Safari 指引"); }
  }
  if (expect === "desktop") {
    if (!/安装|应用/.test(text)) { ok = false; problems.push("不是桌面安装指引"); }
  }

  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(18)} ${g.tip || "(hidden)"}`);
  for (const p of problems) console.log(`        -> ${p}`);
}

console.log("=".repeat(78));
console.log(failures === 0 ? `全部 ${cases.length} 个浏览器分流正确` : `${failures} 个用例失败`);
process.exit(failures ? 1 : 0);
