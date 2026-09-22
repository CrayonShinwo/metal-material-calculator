# 金属材料计算器 · 安卓版说明

## 一、地址

| 项目 | 地址 |
|---|---|
| 网站 | https://crayonshinwo.github.io/metal-material-calculator/ |
| 代码仓库 | https://github.com/CrayonShinwo/metal-material-calculator |
| **APK 下载** | https://crayonshinwo.github.io/metal-material-calculator/download/metal-material-calculator.apk |
| AAB（上架用） | https://crayonshinwo.github.io/metal-material-calculator/download/metal-material-calculator.aab |
| 应用校验文件 | https://crayonshinwo.github.io/.well-known/assetlinks.json |

## 二、安卓怎么装

**方式 1 · Chrome 一键安装（推荐）**
用 Chrome 打开网站 → 底部出现安装卡片 → 点黄色「立即安装」按钮。
（或右上角 `⋮` →「安装应用」／「添加到主屏幕」）

**方式 2 · 直接装 APK（任何浏览器都行，推荐发给别人）**
- 下载页（建议分享这个链接）：https://crayonshinwo.github.io/metal-material-calculator/download.html
- 直链：https://crayonshinwo.github.io/metal-material-calculator/download/metal-material-calculator.apk

下载 → 点开文件安装 → 提示「允许安装未知来源应用」时允许即可。
这是**已签名的正式包**，装完桌面有图标、全屏运行、可离线。
**不需要 Chrome** —— 小米/华为/vivo/UC/夸克/Firefox 等浏览器都能下载。

**方式 3 · 上架应用商店**
把 `download/metal-material-calculator.aab` 上传到 Google Play Console。

## 三、为什么在微信里点 APK 不能直接安装

**这不是包的问题，是微信故意的限制。** 三个原因叠加：

1. **微信内置浏览器禁止直接下载/安装 APK。** 腾讯为了防恶意软件（也为了保护自家应用宝），在微信里点 `.apk` 链接会被拦截：要么提示「已停止访问该网页」，要么下载后点「打开」毫无反应。
2. **安卓系统的「未知来源」限制。** Android 8 以上要求「打开这个安装包的那个 App」本身有安装权限。微信不会申请这个权限，所以就算文件下到手机里，从微信里点它也不会启动安装器。
3. **在微信里发 APK 文件本身也会被限制**，部分版本会改名或直接拦截。

### 正确的分享话术

**建议直接分享这个下载页**（纯静态、不依赖 JS，任何浏览器都能打开）：

> 点这里下载安卓版 👉 https://crayonshinwo.github.io/metal-material-calculator/download.html

对方如果在微信里点开了，引导他：**点右上角 `⋯` → 「在浏览器打开」**，再点下载。
（网页里的安装卡片也会自动识别微信/QQ/钉钉等内置浏览器并给出这段提示。）

### 关键：下载 APK 不需要 Chrome

任何**真正的浏览器**都能下载并安装这个 APK —— 实测同一个链接在这些 UA 下全部
返回 `200` + `application/vnd.android.package-archive` + 完整 1,069,230 字节：

小米浏览器、华为浏览器、vivo 浏览器、UC、夸克、Firefox、三星浏览器、Edge、Chrome。

只有**社交 App 的内置浏览器**（微信、QQ、钉钉、微博、支付宝）会拦下载，因为那是客户端行为。
所以：

| 场景 | 能不能装 |
|---|---|
| 任意浏览器 + 下载 APK | ✅ 可以 |
| Chrome / Edge / 三星浏览器 + 「添加到主屏幕」 | ✅ 可以 |
| 小米/华为/vivo/UC/夸克 浏览器 + 「添加到主屏幕」 | ❌ 不行（但这些浏览器**下载 APK 没问题**） |
| 微信/QQ/钉钉内置浏览器 + 任何方式 | ❌ 下载被拦，必须先「在浏览器打开」 |

### 更稳的办法

- 先用 **Chrome 安装成 PWA**（方式 1），再分享网站链接 —— 对方在 Chrome 里能一键装，全程不碰 APK。
- 或把 APK 用**文件传输助手 / QQ / 网盘**发给对方，让对方在**文件管理**里点击安装，绕开微信浏览器。
- ⚠️ `github.io` 在国内网络偶尔不稳定。如果对方连网页都打不开，直接把 APK 文件传给他最保险。

## 四、这次改了什么

1. **新增安卓安装引导**（`js/install.js`、`css/install.css`）：按机型/浏览器给对应步骤；安卓 Chrome/Edge 显示「立即安装」直接调起系统安装；微信/QQ/UC/夸克/小米/华为等不支持安装的浏览器会明确提示换 Chrome；三星浏览器单独路径；iPhone 保留 Safari 分享流程；已装好后整块隐藏。
2. **安卓装不上的真正原因**：站点本身早就满足 Chrome 全部安装条件（manifest、192/512 图标、带 fetch 的 Service Worker、HTTPS 均实测通过），**唯一问题是页面只写了 iPhone 教程**。
3. **新增 maskable 图标**（`assets/icon-maskable-192.png`、`icon-maskable-512.png`）：原图标 logo 占安全圆 78.3%（合规但偏紧）；新图标背景满幅、logo 缩到 70% 安全半径，圆形/方圆形/圆角方形三种遮罩实测都不被切。
4. `manifest.json` 补齐 `id`、`display_override`、`prefer_related_applications: false`；`sw.js` 缓存版本升到 `v12`。
5. 安装卡片内加 APK 直接下载按钮；APK/AAB 发布在 `download/` 目录。

## 五、发新版本

工具在 `tools/`，需要 Node.js。**先准备好 token**（GitHub → Settings → Developer settings → Personal access tokens，勾 `repo`，用完即删）。

```bash
node tools/pull.mjs                      # 把仓库文件拉到 site/
# 改 site/ 里的文件
node tools/push.mjs <token>              # 推送网站 + 工具 + 文档 + APK/AAB
```

要出新的安卓包：

```bash
# 改 tools/build-apk.mjs 顶部的 appVersion / appVersionCode（versionCode 必须递增）
node tools/build-apk.mjs                 # 用 release/ 里的密钥签名，产出 APK/AAB
node tools/assetlinks.mjs <token>        # 若指纹有变，重新发布 assetlinks
```

> `build-apk.mjs` 会自动复用 `release/signing.keystore`，**换密钥会导致老用户无法覆盖安装**。
> 打完包请核对新 `assetlinks.json` 里的 SHA-256 指纹是否仍是
> `3F:26:C3:F5:E5:5B:15:0D:AC:91:06:7F:43:C7:1A:DD:CA:B3:AD:7F:C4:01:02:F0:AD:77:1C:9B:8C:FD:B1:DD`

## 六、保密文件（绝不入库）

仓库是**公开**的。以下文件只保存在本地 `release/`，**不要提交、不要上传**：

| 文件 | 说明 |
|---|---|
| `signing.keystore` | 签名私钥。泄露 = 任何人都能伪造你这个 App 的更新包 |
| `signing.json` | keystore 密码 |
| `签名信息-务必保存.txt` | 密码、指纹等汇总 |

请把这三个文件另外备份到云盘或邮箱。**私钥丢失 = 再也无法发新版本**，只能换包名重新上架。
