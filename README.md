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
      <h3>任何网页</h3>
      <p>在图片、视频或图片链接上右键，选择 <strong>保存到 Momento</strong>。扩展会找页面上最大的那一档：srcset、页面数据里的原图、常见图床的原图地址（知乎、豆瓣、Lofter、B 站、Unsplash、Pexels、ArtStation、Flickr 等）。</p>
    </td>
    <td width="33%">
      <h3>整帖保存</h3>
      <p>在小红书、Instagram、Pixiv、微博、Behance、Dribbble、站酷、花瓣、Pinterest、X 的帖子上右键，选择 <strong>保存这一帖全部</strong>，图片、实况和 mp4 视频一起存。</p>
    </td>
    <td width="33%">
      <h3>批量保存整页</h3>
      <p>点工具栏图标，按尺寸和格式筛选，Shift 连选，一次存进 Momento，只问一次放哪、只提示一次。在页面空白处右键还能 <strong>截取可见区域</strong> 存进去。</p>
    </td>
  </tr>
</table>

扩展不会收集、出售或上传你的数据。它只在你主动选择保存时，把文件地址（`blob:`、`data:` 和截图则是文件本身）和来源页面发送到本机接口：

```text
http://127.0.0.1:47641/api/v1/
```

X 的视频会存最高清的 mp4。其他分片播放的视频（B 站、抖音、直播回放、大多数网站的播放器）暂时存不了，扩展会直接说明。

## 安装

1. 打开 [Releases](https://github.com/Seaony/Momento-Chomre-Extension/releases/latest)，下载 `Momento-Image-Saver-Manual-Install-<version>.zip`。
2. 解压 zip，把解压后的文件夹放在一个会长期保留的位置。
3. 打开 Chrome，在地址栏输入 `chrome://extensions/`。
4. 打开右上角的“开发者模式”。
5. 点击“加载已解压的扩展程序”。
6. 选择解压目录里的 `extension` 文件夹。
7. 确认扩展列表里出现 **Momento Image Saver**。
8. 启动 Momento，然后在网页上右键保存，或点工具栏图标批量保存。

Chrome 要加载的是包含 `manifest.json` 的 `extension` 文件夹，不是外层文件夹，也不是 zip 文件。

手动安装的扩展不会自动更新。升级时下载新的 Release 包，移除旧扩展，再按上面的步骤重新加载新的 `extension` 文件夹。

## 许可证

[MIT](LICENSE)
