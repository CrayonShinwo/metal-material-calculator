// Prove the APK host does not discriminate by browser: same URL, many User-Agents.
const URL_APK = "https://crayonshinwo.github.io/metal-material-calculator/download/metal-material-calculator.apk";

const agents = [
  ["Chrome (Android)", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"],
  ["小米自带浏览器", "Mozilla/5.0 (Linux; U; Android 13; zh-cn; 22081212C Build/TKQ1) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/77.0.3865.120 MQQBrowser/6.2 TBS/045913 Mobile Safari/537.36 XiaoMi/MiuiBrowser/16.2.30"],
  ["华为浏览器", "Mozilla/5.0 (Linux; Android 12; HarmonyOS) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/13.0.1.302 Mobile Safari/537.36"],
  ["vivo 浏览器", "Mozilla/5.0 (Linux; Android 13; V2230A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36 VivoBrowser/19.6.0.0"],
  ["UC 浏览器", "Mozilla/5.0 (Linux; U; Android 12; zh-CN; V2162A Build/SP1A.210812.003) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 UCBrowser/16.2.1.1314 Mobile Safari/537.36"],
  ["夸克", "Mozilla/5.0 (Linux; U; Android 13; zh-CN; 2211133C Build/TKQ1.221114.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.5481.154 Quark/6.9.5.260 Mobile Safari/537.36"],
  ["Firefox (Android)", "Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0"],
  ["Samsung Internet", "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36"],
  ["Edge (Android)", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 EdgA/124.0.2478.62"],
  ["微信内置", "Mozilla/5.0 (Linux; Android 13; PGT-AN10 Build/HUAWEIPGT-AN10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0.5304.141 Mobile Safari/537.36 MicroMessenger/8.0.42.2460"],
  ["无 UA / 老工具", "curl/8.0.1"]
];

console.log("URL:", URL_APK, "\n");
let blocked = 0;
for (const [name, ua] of agents) {
  try {
    const res = await fetch(URL_APK, { headers: { "User-Agent": ua }, redirect: "follow" });
    const len = (await res.arrayBuffer()).byteLength;
    const ct = res.headers.get("content-type");
    const ok = res.status === 200 && ct === "application/vnd.android.package-archive";
    if (!ok) blocked++;
    console.log(`${ok ? "ok  " : "BAD "} ${name.padEnd(20)} HTTP ${res.status}  ${String(len).padStart(9)} bytes  ${ct}`);
  } catch (e) {
    blocked++;
    console.log(`BAD  ${name.padEnd(20)} ERROR ${e.cause?.code || e.message}`);
  }
}
console.log(blocked === 0
  ? "\n结论: 服务器对所有浏览器一视同仁，任何浏览器都能下载这个 APK。"
  : `\n${blocked} 个 UA 被拒绝`);
