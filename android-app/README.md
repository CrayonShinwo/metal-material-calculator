# android-app/ — 金属材料计算器 · 离线安卓版

这是**根治**「打开 App 卡在黄色六边形启动图、永远进不去」的打包方案。

## 为什么要有这个工程

旧的 APK 是 PWABuilder 生成的 **远程 TWA**：包内一个网页文件都没有，启动时必须委托 Chrome 去
下载 `https://crayonshinwo.github.io/metal-material-calculator/`。所以只要满足下面任意一条，
用户就永远停在启动图（那张图就是 `drawable/splash`，深色底 + 黄色六边形 + `kg`）：

- 网络访问不了 `github.io`（国内常见）；
- 设备上没有 Chrome / 不支持 Custom Tabs（国产 ROM 常见）—— **实测换网络后依然卡住，正是这条**。

本工程把 HTML/CSS/JS/图标全部打进 APK，用 `WebViewAssetLoader` 在进程内以
`https://appassets.androidplatform.net/assets/www/` 这个安全上下文交给 WebView：

| | 旧版（远程 TWA） | 本版（离线 WebView） |
|---|---|---|
| 页面来源 | 每次启动现下载 | APK 内 `assets/www/`（约 195 KB） |
| 需要 Chrome / Custom Tabs | **是** | **否** |
| 需要联网 | **是**（否则卡启动图） | **否**，飞行模式可正常使用 |
| 冷启动耗时 | 取决于网络 | 常数级（本地读取） |

关键实现点（见 `app/src/main/java/io/github/crayonshinwo/metalcalc/MainActivity.kt`）：

- `WebViewAssetLoader` 走 `https://appassets.androidplatform.net/…`，因此 ES Module、
  `navigator.clipboard` 等"安全上下文"特性全部可用（用 `file://` 会被浏览器安全策略拦掉）。
- **不打包 `sw.js`**：WebView 里由 Service Worker 发起的请求**不经过** `WebViewAssetLoader`
  的拦截，会真的去打网络并失败。离线版资源本来就在本地，不需要 SW。`js/app.js` 里的
  `register("./sw.js")` 会 404 失败，并被它自己的 `.catch(() => {})` 静默吞掉，无副作用。
- `index.html` 里"安装到手机桌面"卡片与页脚"下载 APK"入口会被打包脚本删掉（已经在 App 里了）。
- 应用内资源不出进程；外部链接（例如文档里的 GitHub 地址）交给系统浏览器打开。

## 环境要求

| 项目 | 要求 |
|---|---|
| Android Studio | Ladybug (2024.2) 或更新（自带 SDK + Gradle + JBR 21） |
| JDK | **17 或 21**。⚠️ 本机现有的 JDK 23 **不被 AGP 8.6 支持**，请用 Android Studio 自带的 JBR |
| Android SDK | `compileSdk 35`（Android Studio 会引导安装） |
| Gradle | 8.9（`gradle/wrapper/gradle-wrapper.properties` 已指定） |
| 首次构建 | 需要联网下载 Gradle 发行包与 AndroidX 依赖 |

## 构建

### 方式一：Android Studio（推荐）

1. `File → Open`，选择本目录（`android-app/`）。
2. 等待 Gradle Sync。若提示缺少 Gradle wrapper，选 **Use default Gradle wrapper** 即可。
3. `Build → Build Bundle(s) / APK(s) → Build APK(s)`。
4. 产物：`app/build/outputs/apk/release/app-release.apk`。

### 方式二：命令行

```bash
# 1) 指定 SDK 路径（或者设 ANDROID_HOME 环境变量）
echo "sdk.dir=C\:\\Users\\<你>\\AppData\\Local\\Android\\Sdk" > local.properties

# 2) 若仓库里没有 gradle-wrapper.jar，先用 Android Studio 自带的 gradle 生成一次
gradle wrapper --gradle-version 8.9

# 3) 打 release 包（复用 release/ 里的签名密钥）
./gradlew assembleRelease          # Windows: .\gradlew.bat assembleRelease

# 上架 Google Play 用：
./gradlew bundleRelease
```

产物统一命名后放进 `release/`：

```powershell
copy app\build\outputs\apk\release\app-release.apk ..\release\metal-material-calculator-1.1.0-offline.apk
```

### 签名

`app/build.gradle.kts` 会自动读取 **`../release/signing.keystore` + `../release/signing.json`**：

- 读得到 → 用**和旧版同一把密钥**签名（`applicationId` 也保持一致），老用户可以直接覆盖安装，
  桌面图标和 App 会被就地升级，不需要卸载。
- 读不到 → release 包不带签名配置，只能打 debug 包（`applicationId` 会变成 `.debug` 后缀）。

> `release/` 是保密目录，**永远不要提交**。`tools/push.mjs` 也内置了拒绝上传密钥类文件的防线。

版本号：`versionCode = 2`、`versionName = "1.1.0"`（旧版是 `versionCode 1` / `1.0.0.0`）。
**每次发新版必须递增 `versionCode`。**

## 更新页面内容

页面资源的唯一真源永远是 `site/`。改完 `site/` 后：

```bash
node tools/bundle-offline.mjs          # 重新生成 assets/www + 桌面图标
node tools/bundle-offline.mjs --check  # 只检查是否同步（CI 可用，不同步则退出码 1）
```

⚠️ **不要直接改 `app/src/main/assets/www/` 里的文件** —— 它们是生成产物，下次打包会被覆盖。
打包脚本只要发现 `site/index.html` 的结构变了（找不到预期的锚点）就会**直接报错退出**，
避免悄悄打出一个带着"下载 APK"按钮的怪版本。

## 验证清单（装机后逐项过）

| 场景 | 期望 |
|---|---|
| **飞行模式下冷启动** | 直接进计算器主界面（这条最能证明问题已根治） |
| 正常冷启动 | ≤1s 进主界面，不再出现"只有黄色六边形"的画面 |
| 热启动（Home 后再进） | 秒开，保留上次输入 |
| 首次安装（无 Chrome 的设备） | 正常进主界面（旧版在这种设备上必然卡死） |
| 覆盖升级旧版 | 直接覆盖安装成功，不需要卸载，桌面只有一个图标 |
| 计算 / 单位切换 / 复制结果 | 与网页版完全一致 |
| 断网时的复制结果 | 仍可用（`clipboard` API 在 `appassets` https 上下文里正常） |
| 返回键 | 正常退出（页面无历史时不闪退） |

## 目录结构

```
android-app/
├─ settings.gradle.kts / build.gradle.kts / gradle.properties
├─ gradle/wrapper/gradle-wrapper.properties
└─ app/
   ├─ build.gradle.kts                 ← 复用 release/ 签名；versionCode 2
   ├─ proguard-rules.pro
   └─ src/main/
      ├─ AndroidManifest.xml
      ├─ java/io/github/crayonshinwo/metalcalc/MainActivity.kt
      ├─ res/{layout,values,drawable,mipmap-anydpi-v26,mipmap-xxxhdpi}
      └─ assets/www/                   ← 由 tools/bundle-offline.mjs 生成（勿手改）
```
