// Service Worker：预缓存应用外壳 + 网络优先（**带超时**）+ 缓存兜底 + 离线提示页
//
// 与 v13 的差异（都是为了修「启动卡在加载页 / 长时间无跳转」）：
//   1. v13 是「先联网，失败才读缓存」，而 fetch 完全没有超时。
//      国内访问 github.io 经常是"TCP 连上了但服务器一直不回数据"（连接被黑洞），
//      这时 fetch 既不 resolve 也不 reject —— 导航请求会永远挂起，页面永远出不来。
//      现在所有网络请求都用 AbortController 限时（导航 3.5s / 资源 5s），
//      超时立刻回退到缓存，最坏也能在几秒内把页面显示出来。
//   2. 首次安装且完全无网时，返回一张内置的离线提示页（深色 + kg 图标 + 重试按钮），
//      而不是 v13 那样返回 503 纯文本（在 App/WebView 里看起来就是白屏）。
//   3. 预缓存从 cache.addAll 改成逐个写入：v13 只要 18 个文件里有任意一个 404，
//      整次安装就失败 → 一点缓存都没有，离线能力直接归零。
//   4. 只接管同源 GET，跨域请求一律放行，避免污染第三方请求。
const CACHE_NAME = "metal-calc-v14";

const PRECACHE = [
  "./",
  "./index.html",
  "./download.html",
  "./css/base.css",
  "./css/form.css",
  "./css/result.css",
  "./css/install.css",
  "./js/materials.js",
  "./js/tables.js",
  "./js/calc.js",
  "./js/app.js",
  "./js/install.js",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-192.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon.png"
];

// 网络等待上限：超过就回退缓存。宁可给旧版，也不能一直转圈打不开。
const NAV_TIMEOUT_MS = 3500;
const ASSET_TIMEOUT_MS = 5000;
const PRECACHE_TIMEOUT_MS = 15000;

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>暂时打不开 · 金属材料计算器</title>
<style>
  :root { --bg:#14171B; --yellow:#FFC400; --text:#E8EDF2; --muted:#8B96A3; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
         gap:14px; padding:32px 24px; text-align:center; background:var(--bg); color:var(--text);
         font-family:"Bahnschrift","PingFang SC","Microsoft YaHei",sans-serif; }
  .hex { width:88px; height:88px; display:grid; place-items:center; background:var(--yellow); color:#14171B;
         font-weight:800; font-size:26px; letter-spacing:-.03em;
         clip-path:polygon(25% 4%,75% 4%,98% 50%,75% 96%,25% 96%,2% 50%); }
  h1 { font-size:20px; letter-spacing:.04em; }
  p { color:var(--muted); font-size:13px; line-height:1.7; max-width:22em; }
  button { margin-top:6px; padding:12px 30px; border:0; border-radius:12px; background:var(--yellow);
           color:#14171B; font-size:15px; font-weight:700; font-family:inherit; }
  small { color:var(--muted); font-size:11px; line-height:1.7; max-width:22em; }
</style>
</head>
<body>
  <div class="hex">kg</div>
  <h1>暂时打不开</h1>
  <p>应用需要联网下载一次才能离线使用，当前网络没能连上服务器。</p>
  <button type="button" onclick="location.reload()">重试</button>
  <small>请确认手机已联网（Wi-Fi 或移动数据），然后点「重试」。<br>
  如果反复失败，说明当前网络访问不了应用的服务器，请换一个网络再试。</small>
</body>
</html>`;

function offlineResponse(reason) {
  // 刻意用 200：5xx 在部分 WebView / TWA 里会被替换成浏览器错误页，
  // 200 + text/html 才能保证用户一定看到上面这段可操作的提示。
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Offline-Fallback": reason || "offline"
    }
  });
}

function fetchWithTimeout(request, ms, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const options = Object.assign({ signal: controller.signal }, init || {});
  return fetch(request, options).finally(() => clearTimeout(timer));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // 逐个预缓存：单个文件失败只跳过它自己，绝不让整次安装失败（v13 的 addAll 会）
        Promise.allSettled(
          PRECACHE.map((url) =>
            fetchWithTimeout(new Request(url, { cache: "reload" }), PRECACHE_TIMEOUT_MS)
              .then((response) => {
                if (response && response.ok) return cache.put(url, response);
                throw new Error("HTTP " + (response && response.status));
              })
              .catch((error) => {
                console.warn("[sw] 预缓存失败，跳过：", url, error && error.message);
              })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // 只管自己的资源；跨域请求交给浏览器自己处理
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    request.mode === "navigate" ? handleNavigation(request) : handleResource(request)
  );
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetchWithTimeout(request, NAV_TIMEOUT_MS, { cache: "no-cache" });
    if (fresh && fresh.ok) {
      await cache.put(request, fresh.clone()).catch(() => {});
      return fresh;
    }
    throw new Error("HTTP " + (fresh && fresh.status));
  } catch (error) {
    // 超时 / 断网 / 服务端报错 —— 一律退回已缓存的应用外壳
    const cached =
      (await cache.match(request)) ||
      (await cache.match("./index.html")) ||
      (await cache.match("./"));
    if (cached) return cached;
    return offlineResponse(error && error.name === "AbortError" ? "timeout" : "offline");
  }
}

async function handleResource(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetchWithTimeout(request, ASSET_TIMEOUT_MS);
    if (fresh && fresh.ok) {
      await cache.put(request, fresh.clone()).catch(() => {});
      return fresh;
    }
    throw new Error("HTTP " + (fresh && fresh.status));
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response("资源暂时不可用（离线且未缓存）", {
      status: 504,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
