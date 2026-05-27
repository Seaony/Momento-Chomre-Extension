# Momento Image Saver

Momento Image Saver 是一个 Chrome Manifest V3 扩展，用于把网页图片保存到本机运行的 Momento。

## 本地开发安装

1. 启动 Momento，并让它保持在后台运行。
2. 打开 Chrome，在地址栏输入 `chrome://extensions`。
3. 打开右上角的开发者模式。
4. 点击“加载已解压的扩展程序”，选择 `/Users/seaony/code/Momento-Chrome`。

## 使用方式

在 Chrome 里右键网页图片，然后选择 **Save Image to Momento**。

在 Instagram 页面，同一个操作会出现在页面右键菜单里。因为 Instagram 经常在真实 `<img>` 上方放置覆盖层，扩展会记录最后一次右键点击的位置，并根据该位置查找实际图片。

在小红书笔记详情页，可以在页面空白处右键，然后从 Chrome 原生右键菜单中选择 **Save All Images to Momento**，把当前笔记轮播里的所有图片导入 Momento。扩展会优先使用页面数据或已渲染轮播里的 `url_default` / `WB_DFT` 图片 URL，不会自行拼接另一种 CDN URL。导入完成后，页面会显示 toast，告诉用户保存了多少原图、多少 fallback 图片，以及失败数量。

扩展会把图片 URL 和来源页面 URL 发送给 Momento 的本地导入接口：

```text
http://127.0.0.1:47641/api/v1/import/image
```

Momento 会在本机下载图片，并导入当前打开的图库。这个过程不会打开新标签页，也不会把 Momento 主窗口强制切到前台。

## 当前限制

- Momento 必须已经在本机运行。
- 只支持 `http://` 和 `https://` 图片 URL。
- 如果图片需要 Chrome 内部 Cookie 或页面登录态才能访问，Momento 可能无法下载。
- 这个轻量桥接扩展不支持 `blob:` 和 `data:` 图片。

## 隐私

Momento Image Saver 不收集、不出售，也不会把用户数据上传到第三方服务器。只有当用户主动选择保存操作时，扩展才会把被选择的图片 URL 和来源页面 URL 发送到本机 Momento：

```text
http://127.0.0.1:47641/api/v1/import/image
```

Momento 会在用户自己的 Mac 上下载图片，并导入当前打开的本地图库。

扩展不使用分析、广告、追踪 Cookie 或远程代码，也不会在 Chrome storage 里保存浏览历史或图片历史。

## Chrome Web Store 打包

在仓库根目录运行：

```sh
scripts/package-extension.sh
```

脚本会校验 manifest 和图标路径，然后生成可用于 Chrome Web Store 审核的 zip：

```text
dist/momento-image-saver-<version>.zip
```

这个包只包含扩展运行文件，不包含测试、Git 元数据和发布说明。

Chrome Web Store 审核材料放在 `release/chrome-web-store/`。
