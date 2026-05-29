<div align="center">
  <br />
  <img src="icons/icon-128.png" width="112" alt="Momento Image Saver Icon" />
  <h1>Momento Image Saver</h1>
  <p><strong>把浏览器里的图片，直接保存到本机 Momento。</strong></p>
  <p>
    一个轻量的 Chrome 扩展，只在你主动右键保存时工作，
    把图片 URL 交给本机正在运行的 Momento 导入。
  </p>
  <p>
    <a href="https://github.com/Seaony/Momento-Chomre-Extension/releases/latest"><strong>下载最新版</strong></a>
    ·
    <a href="#它做什么">它做什么</a>
    ·
    <a href="#安装">安装</a>
  </p>
  <p>
    <img alt="Chrome Manifest V3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?style=flat-square&labelColor=222222" />
    <img alt="Local Import" src="https://img.shields.io/badge/Import-Local%20Momento-111111?style=flat-square&labelColor=222222" />
    <img alt="No Tracking" src="https://img.shields.io/badge/Tracking-None-34A853?style=flat-square&labelColor=222222" />
  </p>
  <br />
</div>

## 它做什么

Momento Image Saver 是 Momento 的浏览器入口。你在网页上看到想收藏的图片时，不需要先下载到本地再手动导入，直接从 Chrome 右键菜单发送给 Momento。

<table>
  <tr>
    <td width="33%">
      <h3>普通网页图片</h3>
      <p>在图片上右键，选择 <strong>Save Image to Momento</strong>，Momento 会在本机下载并导入当前图库。</p>
    </td>
    <td width="33%">
      <h3>Instagram</h3>
      <p>在页面上右键，扩展会根据右键位置找到真实图片，避开页面覆盖层带来的误点。</p>
    </td>
    <td width="33%">
      <h3>小红书笔记</h3>
      <p>在笔记详情页右键，选择 <strong>Save All Images to Momento</strong>，批量保存当前轮播里的图片。</p>
    </td>
  </tr>
</table>

扩展不会收集、出售或上传你的数据。它只在你主动选择保存时，把图片 URL 和来源页面 URL 发送到本机接口：

```text
http://127.0.0.1:47641/api/v1/import/image
```

## 安装

1. 打开 [Releases](https://github.com/Seaony/Momento-Chomre-Extension/releases/latest)，下载 `Momento-Image-Saver-Manual-Install-<version>.zip`。
2. 解压 zip，把解压后的文件夹放在一个会长期保留的位置。
3. 打开 Chrome，在地址栏输入 `chrome://extensions/`。
4. 打开右上角的“开发者模式”。
5. 点击“加载已解压的扩展程序”。
6. 选择解压目录里的 `extension` 文件夹。
7. 确认扩展列表里出现 **Momento Image Saver**。
8. 启动 Momento，然后在网页图片上右键保存。

Chrome 要加载的是包含 `manifest.json` 的 `extension` 文件夹，不是外层文件夹，也不是 zip 文件。

手动安装的扩展不会自动更新。升级时下载新的 Release 包，移除旧扩展，再按上面的步骤重新加载新的 `extension` 文件夹。
