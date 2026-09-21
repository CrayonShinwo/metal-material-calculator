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

// App 内置浏览器与部分国产浏览器：不支持安装 PWA，引导用户换 Chrome / Edge。
const isInAppOrUnsupported =
  /MicroMessenger|QQ\/|QQBrowser|Weibo|Alipay|DingTalk|UCBrowser|UBrowser|Quark|BaiduHD|baidubrowser|SogouMobileBrowser|MiuiBrowser|HuaweiBrowser|HeyTapBrowser|VivoBrowser/i.test(
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
    if (isInAppOrUnsupported) {
      return {
        tip: "当前浏览器不支持安装，请先用 Chrome 打开本页",
        steps: [
          "点右上角「⋯」→「在浏览器打开」（或「用系统浏览器打开」）",
          "在 Chrome 中打开本页，点右上角「⋮」",
          "选择「安装应用」或「添加到主屏幕」，确认「安装」"
        ],
        note: "微信、QQ、UC、夸克、小米/华为自带浏览器都无法把网页装成桌面 App。"
      };
    }
    if (isSamsungInternet) {
      return {
        tip: "在三星浏览器中三步装到桌面，之后全屏、离线可用",
        steps: [
          "点右下角「☰」菜单",
          "选择「添加页面到」→「主屏幕」",
          "确认「添加」，桌面会出现「材料计算器」图标"
        ],
        note: "也可以安装 Chrome 后打开本页，点「⋮」→「安装应用」。"
      };
    }
    return {
      tip: "在 Chrome / Edge 中三步装到桌面，之后全屏、离线可用",
      steps: [
        "点右上角「⋮」（Edge 是「…」）",
        "选择「安装应用」，若没有该项就选「添加到主屏幕」",
        "确认「安装」，桌面会出现「材料计算器」图标"
      ],
      note: "如果点「立即安装」无反应，就按上面步骤从菜单里手动添加。"
    };
  }

  return {
    tip: "在 Chrome / Edge 中可安装为独立窗口应用",
    steps: [
      "点地址栏右侧的「安装」图标（⊕ 或显示器图标）",
      "或打开「⋮」菜单 →「投放、保存和共享」→「安装页面为应用」"
    ],
    note: "安卓手机同样支持：用 Chrome 打开本页即可安装。"
  };
}

let deferredPrompt = null;
let card = null;
let tipEl = null;
let stepsEl = null;
let btnEl = null;
let noteEl = null;

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
