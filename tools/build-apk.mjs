// Build a signed APK + AAB through PWABuilder's live Android packaging service,
// then unpack the result into release/.
//
// Usage (run from the project root):  node tools/build-apk.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { extractZip } from "./unzip.mjs";

// ---------------------------------------------------------------------------
// 发新版本前改这两行（versionCode 必须递增）
// ---------------------------------------------------------------------------
const appVersion = "1.0.0.0";
const appVersionCode = 1;

const BASE = "https://pwabuilder-cloudapk.azurewebsites.net";
const SITE = "https://crayonshinwo.github.io/metal-material-calculator";
const ORIGIN = "https://crayonshinwo.github.io";
const CACHE = "no-cache";

const REL = "release";
fs.mkdirSync(REL, { recursive: true });

// reuse the existing signing key, otherwise updates would be impossible
const KEYSTORE = path.join(REL, "signing.keystore");
const KEYINFO = path.join(REL, "signing.json");
const pw = () => crypto.randomBytes(18).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 20) + "Aa1";

let signingMode = "new";
let signing = {
  file: null,
  alias: "metal-calc",
  fullName: "CrayonShinwo",
  organization: "CrayonShinwo",
  organizationalUnit: "metal-material-calculator",
  countryCode: "CN",
  keyPassword: pw(),
  storePassword: pw()
};
if (fs.existsSync(KEYSTORE) && fs.existsSync(KEYINFO)) {
  const info = JSON.parse(fs.readFileSync(KEYINFO, "utf8"));
  signingMode = "mine";
  signing = {
    ...signing,
    file: `data:application/octet-stream;base64,${fs.readFileSync(KEYSTORE).toString("base64")}`,
    alias: info.alias,
    keyPassword: info.keyPassword,
    storePassword: info.storePassword
  };
  console.log(`复用已有签名密钥（alias ${info.alias}）—— 新包可以覆盖安装旧版本`);
} else {
  console.log("!! 没找到 release/signing.keystore + signing.json");
  console.log("!! PWABuilder 会生成一把【新】密钥，老用户将无法覆盖安装！");
}

const payload = {
  additionalTrustedOrigins: [],
  appVersion,
  appVersionCode,
  backgroundColor: "#14171B",
  display: "standalone",
  enableSiteSettingsShortcut: true,
  enableNotifications: false,
  includeSourceCode: false,
  fallbackType: "customtabs",
  features: { locationDelegation: { enabled: false }, playBilling: { enabled: false } },
  host: ORIGIN,
  iconUrl: `${SITE}/assets/icon-512.png`,
  launcherName: "材料计算器",
  name: "金属材料计算器",
  maskableIconUrl: `${SITE}/assets/icon-maskable-512.png`,
  navigationColor: "#14171B",
  navigationColorDark: "#14171B",
  navigationDividerColor: "#14171B",
  navigationDividerColorDark: "#14171B",
  orientation: "portrait",
  packageId: "io.github.crayonshinwo.metalcalc",
  pwaUrl: `${SITE}/`,
  serviceAccountJsonFile: null,
  shortcuts: [],
  signingMode,
  signing,
  splashScreenFadeOutDuration: 300,
  startUrl: "/metal-material-calculator/",
  themeColor: "#14171B",
  themeColorDark: "#14171B",
  webManifestUrl: `${SITE}/manifest.json`
};

// make sure the site is actually live before asking the service to fetch it
const live = await fetch(`${SITE}/manifest.json`, { cache: CACHE });
if (!live.ok) { console.error(`site not reachable (HTTP ${live.status}) - deploy first`); process.exit(1); }
console.log(`site ok, building version ${appVersion} (code ${appVersionCode}) ...`);

const enq = await fetch(`${BASE}/enqueuePackageJob`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "platform-identifier": "ServerUI",
    "platform-identifier-version": "1.0.0"
  },
  body: JSON.stringify(payload)
});
const enqText = await enq.text();
if (!enq.ok) { console.error(`enqueue failed: HTTP ${enq.status}\n${enqText}`); process.exit(1); }
const jobId = enqText.trim();
console.log(`job: ${jobId}`);

const started = Date.now();
const deadline = started + 15 * 60 * 1000;
let last = "";
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 5000));
  const jr = await fetch(`${BASE}/getPackageJob?id=${encodeURIComponent(jobId)}`);
  if (!jr.ok) continue;
  const job = await jr.json();
  if (job.status !== last) {
    console.log(`  ${job.status}${job.error ? " | " + job.error : ""} (${Math.round((Date.now() - started) / 1000)}s)`);
    last = job.status;
  }
  if (job.status === "Completed") {
    const zip = await fetch(`${BASE}/downloadPackageZip?id=${encodeURIComponent(jobId)}`);
    if (!zip.ok) { console.error(`zip download failed: HTTP ${zip.status}`); process.exit(1); }
    const zipPath = path.join(REL, "metal-calculator-android-package.zip");
    fs.writeFileSync(zipPath, Buffer.from(await zip.arrayBuffer()));
    console.log(`wrote ${zipPath}`);

    const dest = path.join(REL, "package");
    fs.rmSync(dest, { recursive: true, force: true });
    const names = extractZip(zipPath, dest);
    console.log(`extracted ${names.length} files into ${dest}/`);
    for (const n of names) {
      const p = path.join(dest, n);
      console.log(`  ${n.padEnd(40)} ${String(fs.statSync(p).size).padStart(9)}`);
    }

    // give the .apk / .aab clean ASCII names for publication
    for (const [from, to] of [
      ["金属材料计算器.apk", `metal-material-calculator-${appVersion.split(".").slice(0, 3).join(".")}.apk`],
      ["金属材料计算器.aab", `metal-material-calculator-${appVersion.split(".").slice(0, 3).join(".")}.aab`]
    ]) {
      const src = path.join(dest, from);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(REL, to));
        console.log(`copied -> ${path.join(REL, to)}`);
      }
    }
    console.log("\ndone. now run:  node tools/assetlinks.mjs <token>  (after extracting, if the fingerprint changed)");
    process.exit(0);
  }
  if (job.status === "Failed" || job.status === "Error") { console.error("job failed:", JSON.stringify(job)); process.exit(1); }
}
console.error("timed out");
process.exit(1);
