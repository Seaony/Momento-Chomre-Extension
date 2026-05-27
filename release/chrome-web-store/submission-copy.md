# Momento Image Saver - Chrome Web Store Submission Copy

Last updated: 2026-05-27

Official references checked:
- Chrome Web Store Program Policies: https://developer.chrome.com/docs/webstore/program-policies
- User Data Policy: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- Prepare your store listing: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Declare permissions and privacy practices in Developer Dashboard: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy

## Store Listing

### Short Description

右键将网页图片保存到本机 Momento，支持普通图片、Instagram 定位图片和小红书笔记详情页批量保存。

### Detailed Description

Momento Image Saver 是配合本机 Momento 使用的 Chrome 扩展。它在 Chrome 右键菜单中提供保存入口，让用户把网页图片导入当前运行的本机 Momento。

主要功能：

- 普通网页图片：右键图片，选择 "Save Image to Momento"，将该图片保存到本机 Momento。
- Instagram 页面：在图片区域右键，扩展会根据右键位置定位页面中的实际图片，再发送给本机 Momento 导入。
- 小红书笔记详情页：在笔记详情页右键，选择 "Save All Images to Momento"，批量保存当前笔记图片，并在页面中显示保存结果提示。

工作方式：

- 用户必须先在本机启动 Momento。
- 扩展只在用户主动点击右键菜单保存时工作。
- 扩展会把图片 URL 和来源页面 URL 发送到本机接口 `http://127.0.0.1:47641/api/v1/import/image`。
- Momento 在用户本机下载图片并导入本地图库。
- 扩展不会把图片、图片 URL、来源页面 URL 或浏览数据上传到第三方服务器。
- 扩展不包含广告、分析 SDK、远程代码或追踪功能。

当前限制：

- 需要本机 Momento 正在运行。
- 仅支持 `http://` 和 `https://` 图片 URL。
- `blob:` 和 `data:` 图片不支持。
- 需要网站登录态或浏览器 Cookie 才能访问的图片，可能无法由本机 Momento 下载。

### Category Recommendation

Productivity

Reason: this extension adds a user-initiated workflow action for saving web images into the user's local Momento library.

### Language

Chinese (Simplified) / zh_CN

### Homepage URL Placeholder

`https://<your-domain>/momento-image-saver`

### Support URL Placeholder

`https://<your-domain>/momento-image-saver/support`

## Privacy Practices

### Single Purpose Statement

Momento Image Saver 的单一用途是：让用户通过 Chrome 右键菜单，把自己选择的网页图片保存到同一台电脑上正在运行的 Momento。

扩展不提供广告、分析、推荐、账号体系、云同步或第三方上传功能。

### Permission Justifications

#### `contextMenus`

用于在 Chrome 右键菜单中添加保存入口：

- 普通图片上的 "Save Image to Momento"
- Instagram 页面上的 "Save Image to Momento"
- 小红书笔记详情页上的 "Save All Images to Momento"

该权限是扩展核心功能的入口。扩展只在用户主动选择这些菜单项时执行保存流程。

#### `activeTab`

用于在用户主动点击右键菜单后，临时访问当前标签页，以定位用户要保存的图片或读取当前小红书笔记中的图片 URL。

扩展不会持续读取所有标签页，也不会在后台扫描浏览历史。访问范围由用户当前操作触发，并限制在当前页面。

#### `scripting`

用于在用户触发保存操作后，在当前页面执行必要的图片提取逻辑：

- 小红书笔记详情页：读取页面中已渲染或页面状态中包含的图片 URL。
- 必要时重新注入内容脚本，以便向页面显示保存结果提示。

该权限不用于注入远程代码，也不用于修改网页业务逻辑。

#### `http://127.0.0.1:47641/*`

用于把用户选择的图片 URL 和来源页面 URL 发送给本机 Momento 的本地导入接口：

`http://127.0.0.1:47641/api/v1/import/image`

`127.0.0.1` 是本机 loopback 地址，请求只发送到同一台电脑上的 Momento。扩展不会把这些数据发送到 Momento 之外的服务器或第三方服务。

#### Instagram / Xiaohongshu Content Script Site Access

如果 Developer Dashboard 要求说明声明的站点匹配范围，可使用以下说明：

扩展在 Instagram 页面使用内容脚本记录用户最后一次右键位置，以便在 Instagram 的覆盖层结构中定位实际图片 URL。扩展在小红书笔记详情页使用内容脚本提取当前笔记的图片 URL，并显示保存结果提示。两个内容脚本都只为用户主动触发的保存操作服务，不收集浏览历史，不上传页面内容。

### Data Usage Disclosures

#### Data handled by the extension

- 图片 URL：用户通过右键菜单选择保存的图片地址。
- 来源页面 URL：图片所在页面地址，用于让 Momento 记录来源。
- 小红书笔记图片 URL 列表：仅在用户选择批量保存小红书笔记图片时提取。

#### Data not collected

- 不收集姓名、邮箱、账号 ID、电话号码等个人身份信息。
- 不收集健康、金融、支付或认证信息。
- 不收集精确地理位置。
- 不读取或保存完整浏览历史。
- 不读取页面中的消息、表单、密码或账号内容。
- 不使用广告标识符、追踪 Cookie、分析 SDK 或远程遥测。

#### Data transmission

- 只在用户主动选择保存操作时，把图片 URL 和来源页面 URL 发送到 `http://127.0.0.1:47641/api/v1/import/image`。
- 该地址是用户本机 Momento 的本地接口，不是第三方服务器。
- 扩展不会把数据上传到云端、开发者服务器、广告网络、分析平台或数据代理。

#### Data storage

- 扩展不在 Chrome storage 中保存图片历史、浏览历史或用户档案。
- 导入后的图片由本机 Momento 按其本地图库逻辑保存。

#### Data sale / sharing

- 不出售用户数据。
- 不向第三方共享用户数据。
- 不将数据用于广告、画像、信用评估或与保存图片无关的目的。

## Privacy Policy Draft

### Momento Image Saver Privacy Policy

Last updated: 2026-05-27

Momento Image Saver is a Chrome extension for saving web images into the Momento app running on the same computer.

#### What the extension does

When you choose a Momento save action from Chrome's right-click menu, the extension sends the selected image URL and the source page URL to the local Momento import endpoint:

`http://127.0.0.1:47641/api/v1/import/image`

Momento then downloads the image on your computer and imports it into your local Momento library.

#### Data we handle

The extension may handle:

- the image URL you choose to save;
- the source page URL where the image was found;
- on Xiaohongshu note detail pages, the list of image URLs in the note when you choose the batch save action.

#### What we do not collect

Momento Image Saver does not collect personal information such as your name, email address, account identifiers, phone number, payment information, health information, financial information, authentication information, or precise location.

The extension does not collect your browsing history. It does not use analytics, advertising SDKs, tracking cookies, or remote telemetry.

#### No cloud upload by the extension

Momento Image Saver does not upload images, image URLs, source page URLs, or browsing data to third-party servers. The extension only sends the selected image information to the local Momento app at `127.0.0.1` on the same computer.

#### No sale or third-party sharing

We do not sell user data. We do not share user data with advertisers, analytics providers, data brokers, or other third parties.

#### Local app requirement

Momento Image Saver requires the Momento desktop app to be running locally. If Momento is not running, the extension cannot complete the import.

#### Contact

For privacy or support questions, contact:

`<support-email-or-support-url>`

## Review Notes To Reviewer

### Summary

Momento Image Saver is a Manifest V3 extension with one purpose: save user-selected web images into the Momento desktop app running on the same computer.

The extension uses the local endpoint below:

`http://127.0.0.1:47641/api/v1/import/image`

This endpoint is served by the local Momento app. It is a loopback-only integration. The extension does not send the image URL or source page URL to any remote server.

### Test Requirements

- Chrome with the unpacked or packaged extension installed.
- Momento desktop app running on the same computer.
- Momento must expose the local import endpoint on `127.0.0.1:47641`.

### Basic Image Test

1. Start Momento and keep it running.
2. Open any webpage containing a normal `http://` or `https://` image.
3. Right-click the image.
4. Choose "Save Image to Momento".
5. Verify that the image appears in the local Momento library.

### Instagram Test

1. Start Momento and keep it running.
2. Open an Instagram page that contains an image.
3. Right-click on the visible image area.
4. Choose "Save Image to Momento".
5. Verify that the selected image appears in the local Momento library.

Note: Instagram may place overlay elements above the actual image. The extension records the right-click position and resolves the image under that position.

### Xiaohongshu Note Detail Test

1. Start Momento and keep it running.
2. Open a Xiaohongshu note detail page matching `https://www.xiaohongshu.com/explore/*`.
3. Right-click on the page or image area.
4. Choose "Save All Images to Momento".
5. Verify that the note images appear in the local Momento library.
6. A page toast should show saved/fallback/failure counts after the import attempt.

### If Momento Is Not Running

If Momento is not running, the extension's local request to `127.0.0.1:47641` will fail and the image will not be imported. This is expected because the extension has no remote fallback and does not upload data to any cloud service.

## Screenshot Checklist

Use screenshots that show the actual extension workflow. Avoid claiming cloud sync, backup, AI processing, or any functionality not provided by the extension.

- Store screenshot 1: Chrome right-click menu on a normal webpage image with "Save Image to Momento" visible.
- Store screenshot 2: Momento after the image has been imported locally.
- Store screenshot 3: Instagram page right-click workflow with "Save Image to Momento" visible.
- Store screenshot 4: Xiaohongshu note detail page with "Save All Images to Momento" visible.
- Store screenshot 5: Xiaohongshu import result toast showing saved/fallback/failure counts.
- Remove or blur private account names, personal files, private URLs, notifications, and unrelated browser tabs.
- Use real UI screenshots, not marketing mockups.
- Keep text readable at Chrome Web Store preview sizes.
- Do not show unsupported claims such as automatic cloud backup, third-party upload, all-site batch scraping, or analytics.

## Promotional Image Checklist

### Small Promotional Tile

- Size: 440 x 280 px.
- Format: PNG or JPEG.
- Use the Momento Image Saver name or logo clearly.
- Show the core action: right-click image -> save to local Momento.
- Keep the design readable without relying on small body text.
- Do not imply cloud upload, AI enhancement, cross-device sync, or backup unless those features are separately available and documented.

### Marquee Promotional Tile

- Size: 1400 x 560 px.
- Format: PNG or JPEG.
- Present the extension as a local image-saving bridge for Momento.
- Use product UI or a simple workflow composition instead of abstract decoration.
- Keep important content away from edges so Chrome Web Store cropping does not remove it.
- Avoid badges such as "best", "officially recommended", "secure", or "private by default" unless there is reviewed support for the claim.

### Icon / Brand Asset Check

- Confirm the store icon matches the packaged extension icon.
- Use the final 128 x 128 icon asset for the listing.
- Ensure the icon remains clear on both light and dark Chrome Web Store backgrounds.
