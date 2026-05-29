# Momento Image Saver

Momento Image Saver 是给 Momento 配套的 Chrome 扩展。它把浏览器里的图片交给本机正在运行的 Momento 导入，不经过第三方服务，也不会保存浏览历史或图片历史。

它支持三种保存方式：

- 普通网页图片：在图片上右键，选择 **Save Image to Momento**。
- Instagram：在页面上右键，扩展会根据右键位置找到真实图片。
- 小红书笔记：在笔记详情页右键，选择 **Save All Images to Momento** 批量保存轮播图片。

扩展只在你主动选择保存时，把图片 URL 和来源页面 URL 发送到本机接口：

```text
http://127.0.0.1:47641/api/v1/import/image
```

Momento 负责在本机下载图片，并导入当前打开的图库。

## 安装

1. 打开 [Releases](https://github.com/Seaony/Momento-Chomre-Extension/releases)，下载最新的 `Momento-Image-Saver-Manual-Install-<version>.zip`。
2. 解压 zip，把解压后的文件夹放在一个会长期保留的位置。
3. 打开 Chrome，在地址栏输入 `chrome://extensions/`。
4. 打开右上角的“开发者模式”。
5. 点击“加载已解压的扩展程序”。
6. 选择解压目录里的 `extension` 文件夹。
7. 确认扩展列表里出现 **Momento Image Saver**。
8. 启动 Momento，然后在网页图片上右键保存。

不要直接选择外层的 `Momento-Image-Saver-Manual-Install-<version>` 文件夹，也不要选择 zip 文件本身。Chrome 需要加载的是里面包含 `manifest.json` 的 `extension` 文件夹。

手动安装的扩展不会自动更新。升级时下载新的 Release 包，移除旧扩展，再按上面的步骤重新加载新的 `extension` 文件夹。
