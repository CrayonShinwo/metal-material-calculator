> 本项目基于 [gdjoss/metal-material-calculator](https://github.com/gdjoss/metal-material-calculator) 二次开发，
> 由 CrayonShinwo 维护，并新增了安卓安装支持（Chrome/Edge 可直接安装）与 maskable 图标。
> 安卓安装方式：用 Chrome 打开本页 → 右上角「⋮」→「安装应用」或「添加到主屏幕」。

# 金属材料计算器（PWA）

一个可免费托管、可离线安装到 iPhone 主屏幕的金属材料重量计算器。

**线上地址（已部署）**：https://gdjoss.github.io/metal-material-calculator/ —— 手机用 Safari / Chrome 打开即可「添加到主屏幕」。

## 功能

- 9 种型材：板材、圆棒、方棒、六角棒、圆管、方管、角钢，以及槽钢 / 工字钢（GB/T 706 国标理论重量查表）
- 16 种常见金属：碳钢、304/316 不锈钢、铝、铝合金、紫铜、黄铜、青铜、钛、锌、铅、镍、镁、锡、钨、铸铁
- 支持自定义材料密度输入
- 自定义材料选中后下拉框实时显示当前密度，避免混淆
- 仅选择「自定义材料」时才显示密度输入框，正常材料下不可见
- 页面底部显示版本号，便于确认是否已更新到最新版
- 版本号由 JS 渲染，看到当前版本号即代表最新逻辑已生效
- 新版本安装后页面自动刷新，无需手动重复打开
- 材料与型材下拉选择，单位切换自动换算数值
- 下拉采用系统原生渲染，兼容鸿蒙 / 华为浏览器等旧内核设备
- 尺寸单位 mm / cm / m 切换，结果单位 kg / g / t 切换
- 数量合计、单价金额估算、结果一键复制
- 离线可用（Service Worker 缓存）、主屏幕全屏运行

## 本地预览

注意：`index.html` 使用 ES Module，直接双击打开会因浏览器安全策略失败，必须起本地服务：

```powershell
cd D:\苹果材料计算器app
python -m http.server 8080
```

然后浏览器访问 `http://localhost:8080`。手机在同一 Wi-Fi 下访问 `http://电脑IP:8080`。

## 运行测试

```powershell
node tests/calc.test.js
```

## 免费部署到 GitHub Pages

1. 注册一个免费 GitHub 账号（邮箱即可）。
2. 新建仓库（Public），把本目录所有文件上传（或使用 GitHub Desktop）。
3. 仓库 → Settings → Pages → Source 选择 `main` 分支根目录 → Save。
4. 稍等 1–2 分钟，得到网址：`https://你的用户名.github.io/仓库名/`。
5. 手机 Safari 打开该网址 → 分享 → 添加到主屏幕。

## 装到手机主屏幕

- **iPhone**：Safari 打开网址 → 分享 → 添加到主屏幕。
- **安卓 / 鸿蒙**：Chrome / Edge / 华为浏览器打开 → 菜单 → 添加到主屏幕（Chrome 可能直接提示「安装应用」）。

免费托管平台对比：

| 平台 | 免费额度 | 说明 |
|---|---|---|
| GitHub Pages | 100GB 带宽/月 | 最常用，一个账号可托管无限仓库 |
| Netlify | 100GB 带宽/月 | 支持拖拽上传 |
| Cloudflare Pages | 无限带宽 | 国内访问相对快 |

## 目录结构

```text
.
├─ index.html          页面骨架
├─ css/                base.css 基础 / form.css 表单 / result.css 结果
├─ js/                 materials.js 数据 / tables.js 国标查表 / calc.js 计算 / app.js 交互
├─ assets/             图标
├─ manifest.json       PWA 清单
├─ sw.js               离线缓存
├─ tests/calc.test.js  单元测试
└─ SYSTEM.md           系统说明
```

## 修改数据

新增材料、型材或查表型号：

- 材料：在 `js/materials.js` 的 `MATERIALS` 数组添加 `{ id, name, density }`。
- 查表型材：在 `js/tables.js` 添加数据表，并在 `js/materials.js` 的 `SHAPES` 添加 `{ id, name, icon, formula, table, dims: ['spec','l'], defaults, params }`。
- 普通型材：在 `SHAPES` 数组添加 `{ id, name, icon, formula, dims, defaults, params, volume, validate? }`。
- 添加后需同步更新 `sw.js` 的 `PRECACHE` 版本号，并运行测试。
