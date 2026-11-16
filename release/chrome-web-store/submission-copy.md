# Momento Image Saver：Chrome 应用商店上架文案

更新：2026-11-15，按 0.2.0 的实际功能核对过。

官方说明（填表前再对一遍，政策会改）：
- Chrome Web Store Program Policies: https://developer.chrome.com/docs/webstore/program-policies
- User Data Policy: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- Prepare your store listing: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Declare permissions and privacy practices in Developer Dashboard: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy

## 商店页

### 简短说明

在网页上右键，把图片、视频、整帖内容或当前屏幕截图存进本机的 Momento 图库。

### 详细说明

Momento Image Saver 是 Momento 的浏览器入口。看到想留的图片，不用先下载再拖进去，在网页上右键选「保存到 Momento」就行。需要先在电脑上打开 Momento。

保存单张图片或视频：在图片、视频或图片链接上右键，选「保存到 Momento」。扩展会尽量找原图，比如 srcset 里最大的一档、页面数据里的原图地址，以及知乎、豆瓣、Lofter、B 站、Unsplash、Pexels、ArtStation、Flickr 等网站的原图规则。Instagram 和小红书的图片上盖着透明层，扩展会按右键的位置找到下面那张图。

保存一整帖：在小红书、Instagram、Pixiv、微博、X、Pinterest、Behance、Dribbble、站酷、花瓣、ArtStation 的帖子上右键，选「保存这一帖全部」，图片、实况照片和 mp4 视频一起存。

批量保存整页：点工具栏上的图标，打开批量面板，按尺寸和格式筛选，可以 Shift 连选，选好后一次存进 Momento。

截图：在页面空白处右键，选「截取可见区域保存到 Momento」，当前看到的这一屏会作为 PNG 存进去。

存进去的图片会带上来源网页地址，之后在 Momento 里能点回原页面。

几点限制：
- Momento 没打开时存不了，扩展会提示。
- X 的视频会存最高清的 mp4。B 站、抖音、直播回放这类分片播放的视频存不了，扩展会直接说明。
- 要登录才能看的图片，有时 Momento 下载不到。
- 浏览器自带页面和扩展商店页面不允许截图。

扩展只把你选中的内容交给本机的 Momento，不连任何外部服务器，没有广告、统计或账号。

### 分类

Productivity（效率）

理由：扩展只在用户操作时，把网页图片存进本机的 Momento 图库。

### 语言

中文（简体）/ zh_CN。扩展界面另有英文和日文。

### 主页网址（待填）

`https://<your-domain>/momento-image-saver`

### 支持网址（待填）

`https://<your-domain>/momento-image-saver/support`

## 隐私

### 单一用途

让用户把网页上自己选中的图片、视频或当前页面截图，存进同一台电脑上正在运行的 Momento。

扩展没有广告、统计、推荐、账号、云同步，也不把数据传给第三方。

### 权限说明

#### `contextMenus`

在右键菜单里加四个入口：「保存到 Momento」「保存这一帖全部」「批量保存本页图片…」「截取可见区域保存到 Momento」。只有用户点了其中一项，扩展才开始工作。

#### `activeTab`

用户点了右键菜单或工具栏图标后，临时访问当前这个标签页：找出要保存的图片地址，打开批量面板，或者截取可见区域（`chrome.tabs.captureVisibleTab`）。不读取其他标签页，也不在后台扫描页面。

#### `scripting`

在用户操作后的当前页面里运行扩展自带的脚本：找原图地址、读取帖子里的图片列表、显示批量面板和保存结果提示。网页里 `blob:` 地址的文件只有页面自己能读，也通过这个脚本读出来交给 Momento。扩展不加载远程代码，也不改网页本身的功能。

#### `http://127.0.0.1:47641/*`

把用户选中的内容发给本机 Momento 的导入接口 `http://127.0.0.1:47641/api/v1/`。`127.0.0.1` 是本机地址，请求不会离开这台电脑。

#### 内容脚本（Instagram、小红书）

如果后台要求说明内容脚本的站点范围，用这段：

Instagram 和小红书的图片上盖着透明层，右键时浏览器拿不到图片地址。扩展在这两个网站上放了一个很小的内容脚本，只记下最后一次右键点到的元素，用户选择保存时据此找到下面的图片。它不读取页面内容，不发送任何数据。

### 数据使用声明

#### 扩展会处理的数据

- 用户选中保存的图片或视频地址。
- 来源网页的地址和标题，用来让 Momento 记录来源。
- `blob:`、`data:` 地址的文件内容，以及用户主动截取的可见区域截图。这些文件不能按地址下载，扩展直接把文件交给本机 Momento。
- 用户选择「保存这一帖全部」时，当前帖子里的图片和视频地址列表。为了拿到原图，扩展在 Instagram、Pixiv、微博的页面里向这个网站自己的接口查询帖子信息，请求只发往当前网站，用的是用户在这个网站已有的登录状态，查询结果只用来找出图片地址，不保存也不转发。

#### 不收集的数据

- 姓名、邮箱、账号 ID、电话等个人身份信息。
- 健康、金融、支付或登录凭据。
- 精确位置。
- 浏览历史。
- 网页里的消息、表单、密码等内容。
- 不使用广告标识、追踪 Cookie、统计 SDK 或远程遥测。

#### 数据传输

- 只在用户选择保存时，把上面列出的数据发到 `http://127.0.0.1:47641/api/v1/`，这是本机 Momento 的接口。
- 不上传到云端、开发者服务器、广告网络、统计平台或数据中介。

#### 数据存储

- 扩展自己不存任何东西，没有使用 Chrome storage，不留保存记录。
- 存进来的图片由本机 Momento 放在用户自己的图库里。

#### 出售与共享

- 不出售用户数据。
- 不与第三方共享用户数据。
- 不把数据用于广告、画像、信用评估或保存图片以外的用途。

## 隐私政策（英文，发布到支持网址）

### Momento Image Saver Privacy Policy

Last updated: 2026-11-15

Momento Image Saver is a Chrome extension that saves images and videos from web pages into the Momento app running on your own computer.

#### What the extension does

The extension only acts when you choose one of its actions: Save to Momento, Save Entire Post to Momento, Save Images on This Page, or Save Screenshot of Visible Area. It then sends what you chose to the Momento app on the same computer through its local endpoint:

`http://127.0.0.1:47641/api/v1/`

Momento downloads the files on your computer and adds them to your local library.

#### Data the extension handles

- the address of each image or video you choose to save;
- the address and title of the page it came from, so Momento can link back to the source;
- the file itself when it has no downloadable address (`blob:` and `data:` URLs) and the screenshot when you choose to capture the visible area;
- when you save a whole post, the list of image and video addresses in that post. On Instagram, Pixiv and Weibo the extension asks the site's own page-data endpoint for the post's original images. That request goes only to the site you are on, uses the login you already have there, and the result is used only to find the image addresses.

#### What we do not collect

The extension does not collect your name, email address, account identifiers, phone number, payment, health, financial or authentication information, or location. It does not collect browsing history, and it does not read messages, forms or passwords on web pages. It has no analytics, advertising SDKs, tracking cookies or remote telemetry.

#### Nothing leaves your computer

The extension sends data only to the Momento app at `127.0.0.1` on the same computer. It does not upload anything to our servers or to any third party. The extension itself stores nothing.

#### No sale or sharing

We do not sell user data and do not share it with advertisers, analytics providers, data brokers or anyone else.

#### Momento must be running

If Momento is not running, the extension cannot save anything and tells you so.

#### Contact

For privacy or support questions:

`<support-email-or-support-url>`

## 给审核员的说明（英文）

### Summary

Momento Image Saver is a Manifest V3 extension with one purpose: save images, videos or a screenshot the user picks on a web page into the Momento desktop app on the same computer.

All saves go to `http://127.0.0.1:47641/api/v1/`, which is served by the local Momento app. Nothing is sent to a remote server.

### Test Requirements

- Chrome with the extension installed.
- The Momento desktop app running on the same computer, with the browser extension option turned on in its settings (it listens on `127.0.0.1:47641`).

### Single Image

1. Open any web page with an image.
2. Right-click the image and choose "Save to Momento".
3. The image appears in Momento, and the page shows a short confirmation.

### Whole Post

1. Open a post with several images, for example an Instagram post or a Pixiv artwork page.
2. Right-click on the post and choose "Save Entire Post to Momento".
3. All images in the post appear in Momento.

On Instagram an invisible layer covers the image, so the extension remembers where the user right-clicked and finds the image under that point.

### Save Images on This Page

1. Click the extension icon in the toolbar.
2. A panel lists the images on the page. Filter by size or format, select some, and click save.
3. The selected images appear in Momento.

### Screenshot

1. Right-click an empty area of a page and choose "Save Screenshot of Visible Area".
2. A PNG of the visible area appears in Momento.

### If Momento Is Not Running

The request to `127.0.0.1:47641` fails and the page shows a message asking the user to open Momento. There is no remote fallback.

## 截图清单

用真实界面截图，不说扩展做不到的事。

- 截图 1：普通网页上右键图片，菜单里看得到「保存到 Momento」。
- 截图 2：图片存进 Momento 后的图库界面。
- 截图 3：帖子页右键，菜单里看得到「保存这一帖全部」。
- 截图 4：批量保存面板，带尺寸、格式筛选和已选状态。
- 截图 5：保存完成的提示。
- 去掉或模糊私人账号名、个人文件、私密网址、通知和无关标签页。
- 用真实截图，不用营销合成图。
- 在商店缩略图尺寸下字要看得清。
- 不出现自动云备份、上传到第三方、AI 处理、统计这类扩展没有的功能。

## 宣传图清单

### 小宣传图

- 尺寸 440 × 280，PNG 或 JPEG。
- 名字或图标要清楚。
- 表现核心动作：右键图片，存进本机 Momento。
- 不靠小字说明。
- 不暗示云上传、AI 增强、跨设备同步或备份。

### 大宣传图

- 尺寸 1400 × 560，PNG 或 JPEG。
- 用产品界面或简单的操作流程，不用抽象装饰。
- 重要内容离边缘远一点，免得被商店裁掉。
- 不用「最好」「官方推荐」「安全」「默认隐私」这类说不清依据的标语。

### 图标

- 商店图标和扩展包里的图标一致。
- 用正式的 128 × 128 图标。
- 浅色和深色背景下都看得清。
