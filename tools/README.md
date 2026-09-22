# tools/ — 构建与发布工具

全部只需要 **Node.js 18+**，不依赖 Java / Android SDK / 本地 Gradle。
（APK/AAB 由 PWABuilder 的云端服务打包，本地只负责推送和发布。）

## 目录结构

```
metal-calc-tools/
├─ ANDROID.md          ← 会在推送时同步到仓库根目录
├─ site/               ← 仓库文件的工作副本（pull.mjs 生成）
├─ release/            ← ⚠️ 保密目录，绝不入库
│  ├─ signing.keystore     签名私钥
│  ├─ signing.json         私钥密码
│  ├─ 签名信息-务必保存.txt
│  ├─ *.apk / *.aab        构建产物
│  └─ package/             PWABuilder 返回的原始包
└─ tools/
   ├─ pull.mjs        从仓库拉取全部文件到 site/
   ├─ push.mjs        一次性推送 site/ + tools/ + ANDROID.md + APK/AAB
   ├─ build-apk.mjs   云端打包并签名，产出 APK/AAB
   ├─ assetlinks.mjs  发布 .well-known/assetlinks.json
   └─ unzip.mjs       纯 JS 解压（build-apk 内部使用）
```

## 常用流程

```bash
# 1. 拉取最新网站文件
node tools/pull.mjs

# 2. 编辑 site/ 里的文件（例如 site/index.html）

# 3. 推送（需要一个 GitHub token，勾 repo 权限，用完即删）
node tools/push.mjs <token>

# 4. 需要出新的安卓包时
#    先改 build-apk.mjs 顶部的 appVersion / appVersionCode
node tools/build-apk.mjs
node tools/assetlinks.mjs <token>
```

## 安全约束

`push.mjs` 内置了一道防线：任何路径只要匹配
`*.keystore`、`*.jks`、`*.p12`、`signing*.json`、`*签名信息*`、`*password*`、`*secret*`、`*token*`，
都会被**拒绝上传**并在日志里告警。即使误放进 `site/` 也不会进仓库。

⚠️ 但仍然请保持 `release/` 在 `site/` 之外，并把它排除在任何同步盘之外。

## 密钥为什么不能进仓库

仓库是公开的。签名私钥一旦泄露，任何人都能签一个**冒充你这个 App 的更新包**，
已安装的用户会被直接覆盖安装 —— 比丢文件严重得多。
私钥只需要你自己备份（云盘/邮箱），**永远不要提交**。
