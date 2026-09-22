// 安装引导：让 Android 与 iPhone 都能一键/按步骤装到桌面。
//
// 三种情况分别处理：
//   1. 浏览器支持 beforeinstallprompt（Android Chrome / Edge、桌面 Chrome / Edge）
//      → 显示「立即安装」按钮，点击直接调起系统安装。
//   2. 不支持该事件（iOS Safari、部分国产浏览器、App 内置浏览器）
//      → 按机型显示对应的手动添加步骤。
//   3. 已经以桌面图标（standalone）方式打开，或刚刚安装完成
//      → 整块隐藏，不再打扰。

const ua = navigator.userAgent || "";
const mq = (q) => (window.matchMedia ? window.matchMedia(q) : { matches: false });

const isStandalone =
  mq("(display-mode: standalone)").matches ||
  mq("(display-mode: fullscreen)").matches ||
  mq("(display-mode: minimal-ui)").matches ||
  window.navigator.standalone === true ||
  document.referrer.startsWith("android-app://");

const isIOS =
  /iPad|iPhone|iPod/.test(ua) ||
  (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

const isAndroid = /Android/i.test(ua);

// ① 社交 App 的内置浏览器：不只装不了 PWA，连 APK 下载都会被客户端拦掉，
//    必须先把链接甩到真正的浏览器里。
const isInAppBrowser = /MicroMessenger|QQ\/|Weibo|Alipay|DingTalk|Feishu|Lark/i.test(ua);

// ② 真正的浏览器、只是装不了 PWA（国产浏览器 / Firefox 等）。
//    注意：这类浏览器**下载 APK 完全没问题**，所以绝不能劝用户去装 Chrome。
const isNonInstallableBrowser =
  /QQBrowser|UCBrowser|UBrowser|Quark|BaiduHD|baidubrowser|SogouMobileBrowser|MiuiBrowser|HuaweiBrowser|HeyTapBrowser|VivoBrowser|Firefox|FxiOS/i.test(
    ua
  );

// 三星自带浏览器支持安装，但菜单路径与 Chrome 不同
const isSamsungInternet = /SamsungBrowser/i.test(ua);

const isIOSSafari =
  isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|MicroMessenger|QQ\//.test(ua);

/** 返回当前设备对应的安装文案，hide 为 true 表示不显示安装卡片。 */
function buildGuide() {
  if (isStandalone) return { hide: true };

  if (isIOS) {
    if (!isIOSSafari) {
      return {
        tip: "iPhone / iPad 需要用 Safari 打开本页才能装到桌面",
        steps: [
          "点右上角「⋯」或「分享」，选择「在 Safari 中打开」",
          "在 Safari 中打开后，点底部中间的「分享」按钮",
          "向下找到「添加到主屏幕」→ 点「添加」"
        ],
        note: "必须用 Safari，Chrome / 微信 / QQ 内置浏览器都不支持。"
      };
    }
    return {
      tip: "在 Safari 中两步装到桌面，之后全屏、离线可用",
      steps: [
        "点底部中间的「分享」按钮（方框加向上箭头）",
        "向下找到「添加到主屏幕」→ 点右上角「添加」"
      ],
      note: "装好后从桌面图标打开，就是全屏 App，不再有浏览器地址栏。"
    };
  }

  if (isAndroid) {
    // 社交 App 内置浏览器：先把链接甩到真正的浏览器
    if (isInAppBrowser) {
      return {
        tip: "当前是 App 内置浏览器，下载会被拦截，请先「在浏览器打开」",
        steps: [
          "点右上角「⋯」→「在浏览器打开」（任意浏览器都行，不用特意装 Chrome）",
          "在浏览器里回到本页，点下面的按钮下载安装包",
          "打开下载好的文件，系统询问时允许「安装未知来源应用」"
        ],
        note: "微信、QQ、钉钉等都会拦截 .apk 下载，换成任意浏览器即可。"
      };
    }
    // 三星浏览器：能安装，但菜单路径不同
    if (isSamsungInternet) {
      return {
        tip: "直接下载安装包即可，不需要 Chrome",
        steps: [
          "点下面的按钮下载安装包，再点开下载好的文件",
          "系统询问时允许「安装未知来源应用」",
          "想装成网页 App：点右下角「☰」→「添加页面到」→「主屏幕」"
        ],
        note: "下载安装包这一步，任何浏览器都一样。"
      };
    }
    // 能装 PWA 的浏览器（Chrome / Edge 等）
    if (!isNonInstallableBrowser) {
      return {
        tip: "两种方式任选：点「立即安装」一键装成 App，或直接下载安装包",
        steps: [
          "想一键装成 App：点上面的「立即安装」",
          "想装安装包：点下面的按钮下载，再点开下载好的文件",
          "系统询问时允许「安装未知来源应用」"
        ],
        note: "任何浏览器都能下载安装包，不一定要用 Chrome。"
      };
    }
    return {
      tip: "直接下载安装包即可 —— 任何浏览器都能下载，不需要 Chrome",
      steps: [
        "点下面的按钮下载安装包（若没反应，长按按钮选「下载链接」）",
        "打开下载好的文件，系统询问时允许「安装未知来源应用」",
        "装好后桌面出现图标，全屏运行、可离线"
      ],
      note: "只有想用浏览器「添加到主屏幕」装成网页 App 时才需要 Chrome / Edge，装安装包不用。"
    };
  }

  return {
    tip: "在 Chrome / Edge 中可安装为独立窗口应用",
    steps: [
      "点地址栏右侧的「安装」图标（⊕ 或显示器图标）",
      "或打开「⋮」菜单 →「投放、保存和共享」→「安装页面为应用」"
    ],
    note: "安卓手机同样支持：任何浏览器都能下载安装包，或用 Chrome / Edge 一键安装。"
  };
}

let deferredPrompt = null;
let card = null;
let tipEl = null;
let stepsEl = null;
let btnEl = null;
let noteEl = null;
let dlEl = null;

function render() {
  if (!card) return;

  const guide = buildGuide();
  if (guide.hide) {
    card.hidden = true;
    return;
  }

  card.hidden = false;
  tipEl.textContent = guide.tip;
  stepsEl.innerHTML = guide.steps.map((s) => `<li>${s}</li>`).join("");
  noteEl.textContent = guide.note || "";
  // 只有拿到原生安装事件时才显示按钮，避免点了没反应
  btnEl.hidden = !deferredPrompt;
  // 直接下载 APK 只对安卓有意义
  if (dlEl) dlEl.hidden = !isAndroid;
}

window.addEventListener("beforeinstallprompt", (event) => {
  // 阻止浏览器自带的迷你提示条，改用页面内的「立即安装」按钮
  event.preventDefault();
  deferredPrompt = event;
  if (btnEl) btnEl.hidden = false;
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  if (card) card.hidden = true;
});

function init() {
  card = document.getElementById("install-card");
  tipEl = document.getElementById("install-tip");
  stepsEl = document.getElementById("install-steps");
  btnEl = document.getElementById("install-btn");
  noteEl = document.getElementById("install-note");
  dlEl = document.getElementById("install-download");
  if (!card) return;

  if (btnEl) {
    btnEl.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      btnEl.hidden = true;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome === "accepted") {
        card.hidden = true;
      } else {
        btnEl.hidden = false;
      }
    });
  }

  render();

  const dm = mq("(display-mode: standalone)");
  if (dm.addEventListener) dm.addEventListener("change", render);
}

init();

// 导出给自动化测试用：tools/test-routing.mjs 会在 Node 里用不同 UA 调它，
// 确保「任何浏览器都能下载 APK、只有内置浏览器才需要跳出去」这条分流永远成立。
export { buildGuide };
