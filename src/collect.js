// 在网页里找要保存的图片和视频。整个函数会被 chrome.scripting 注入页面运行，
// 所以必须自成一体：不能引用这个函数外面的任何东西。
// args: { srcUrl, linkUrl, mediaType, post, state }
//   post 为真时找「这一帖全部」；state 是在页面主环境里读到的小红书笔记数据。
// 返回 { items: [{ url, kind, referer, title, upload }], error }，error 取值 nothing / stream。
// eslint-disable-next-line no-unused-vars
async function momentoCollect(args) {
  const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|heic|heif)(?:$|[?#])/i;
  const VIDEO_EXT = /\.(mp4|m4v|mov|webm)(?:$|[?#])/i;
  const MIN_POST_SIZE = 200;

  function absolute(url, base) {
    if (typeof url !== "string" || !url.trim()) {
      return null;
    }
    try {
      const resolved = new URL(url.trim(), base);
      return ["http:", "https:", "data:", "blob:"].includes(resolved.protocol) ? resolved.href : null;
    } catch {
      return null;
    }
  }

  function isHttp(url) {
    return typeof url === "string" && /^https?:\/\//i.test(url);
  }

  // srcset 里的每一档：w 是宽度描述，x 是像素密度描述。按 HTML 标准的切法：地址是连续的非空白字符，
  // 地址末尾的逗号表示这一档结束；否则读到下一个逗号为止都是描述。地址里本身可以带逗号。
  function parseSrcset(srcset, base) {
    if (typeof srcset !== "string") {
      return [];
    }
    const out = [];
    let i = 0;
    while (i < srcset.length) {
      while (i < srcset.length && /[\s,]/.test(srcset[i])) {
        i += 1;
      }
      if (i >= srcset.length) {
        break;
      }
      let end = i;
      while (end < srcset.length && !/\s/.test(srcset[end])) {
        end += 1;
      }
      let raw = srcset.slice(i, end);
      let descriptor = "";
      i = end;
      if (raw.endsWith(",")) {
        raw = raw.replace(/,+$/, "");
      } else {
        const comma = srcset.indexOf(",", i);
        const stop = comma < 0 ? srcset.length : comma;
        descriptor = srcset.slice(i, stop).trim();
        i = stop + 1;
      }
      const url = absolute(raw, base);
      if (!url) {
        continue;
      }
      const w = /^(\d+)w$/i.exec(descriptor);
      const x = /^([\d.]+)x$/i.exec(descriptor);
      out.push({ url, w: w ? Number(w[1]) : 0, x: x ? Number(x[1]) : w ? 0 : 1 });
    }
    return out;
  }

  function largestCandidate(candidates) {
    let best = null;
    for (const candidate of candidates) {
      if (!best || candidate.w > best.w || (candidate.w === best.w && candidate.x > best.x)) {
        best = candidate;
      }
    }
    return best;
  }

  // 同一张图不同尺寸的地址通常文件名相同（目录或参数不同），用它把页面数据里的大图对上。
  function fileKey(url) {
    if (!isHttp(url)) {
      return null;
    }
    try {
      const segment = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
      const key = segment.split(/[!@]/)[0].replace(/\.[a-z0-9]{2,5}$/i, "");
      return key.length >= 8 ? key.toLowerCase() : null;
    } catch {
      return null;
    }
  }

  // 常见图床的缩略图地址换成原图地址。只改确定无签名的站点，带签名的地址（Instagram、小红书）一律不动。
  function upgradeUrl(url) {
    if (!isHttp(url)) {
      return url;
    }
    let u;
    try {
      u = new URL(url);
    } catch {
      return url;
    }
    const host = u.hostname;
    const drop = (...names) => names.forEach((name) => u.searchParams.delete(name));
    if (host === "pbs.twimg.com" && u.pathname.startsWith("/media/")) {
      if (u.searchParams.has("name")) {
        u.searchParams.set("name", "orig");
      }
      u.pathname = u.pathname.replace(/:(small|medium|large|thumb)$/, ":orig");
    } else if (/(^|\.)zcool\.(cn|com\.cn)$/.test(host)) {
      drop("x-oss-process");
    } else if (host === "cdn.dribbble.com") {
      drop("resize", "vertical", "crop", "compress");
    } else if (host === "images.pexels.com") {
      u.search = "";
    } else if (/(^|\.)hdslb\.com$/.test(host)) {
      u.pathname = u.pathname.replace(/@[^/]*$/, "");
    } else if (/(^|\.)sinaimg\.cn$/.test(host)) {
      u.pathname = u.pathname.replace(/^\/(orj|thumb|mw|bmiddle|small|square|crop)[^/]*\//, "/large/");
    } else if (/(^|\.)doubanio\.com$/.test(host)) {
      u.pathname = u.pathname.replace(/\/(s_ratio_poster|m_ratio_poster|s|m|sqxs|sqs)\/public\//, "/l/public/");
    } else if (/(^|\.)lf127\.net$/.test(host) || /(^|\.)lofter\.com$/.test(host)) {
      if ([...u.searchParams.keys()].some((key) => key.startsWith("imageView"))) {
        u.search = "";
      }
    } else if (/(^|\.)artstation\.com$/.test(host)) {
      u.pathname = u.pathname.replace(/\/(micro_square|smaller_square|small_square|small|medium)\//, "/large/");
    } else if (/(^|\.)(huaban|hbimg|huabanimg)\.com$/.test(host)) {
      u.pathname = u.pathname.replace(/_(fw|sq|gr)\d+[a-z]*$/i, "");
    }
    return u.href;
  }

  // 在页面内嵌的 JSON 里找同一文件的各个尺寸：{ key: [{ url, size, hint }] }。
  function embeddedVariants(doc, base) {
    const variants = new Map();
    const hintWords = /(orig|original|source|raw|full|large|max|hd)/i;
    const add = (url, width, height, hint) => {
      const resolved = absolute(url, base);
      const key = fileKey(resolved);
      if (!key) {
        return;
      }
      const list = variants.get(key) || [];
      list.push({ url: resolved, width: width || 0, size: (width || 0) * (height || width || 0), hint: hint ? 1 : 0, order: list.length });
      variants.set(key, list);
    };
    const walk = (node, keyName, depth) => {
      if (!node || depth > 40) {
        return;
      }
      if (typeof node === "string") {
        if (/^(https?:)?\/\//.test(node) && (IMAGE_EXT.test(node) || /\/(image|img|photo|media|upload)/i.test(node))) {
          add(node.startsWith("//") ? `https:${node}` : node, 0, 0, hintWords.test(keyName || ""));
        }
        return;
      }
      if (typeof node !== "object") {
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((child) => walk(child, keyName, depth + 1));
        return;
      }
      const url = typeof node.url === "string" ? node.url : typeof node.src === "string" ? node.src : null;
      if (url && (typeof node.width === "number" || typeof node.height === "number")) {
        add(url.startsWith("//") ? `https:${url}` : url, node.width, node.height, hintWords.test(keyName || ""));
      }
      for (const [key, value] of Object.entries(node)) {
        if (value !== url) {
          walk(value, key, depth + 1);
        }
      }
    };
    for (const script of doc.querySelectorAll('script[type="application/json"], script[type="application/ld+json"], script#__NEXT_DATA__')) {
      const text = script.textContent || "";
      if (text.length > 8_000_000) {
        continue;
      }
      try {
        walk(JSON.parse(text), "", 0);
      } catch {
        // 不是合法 JSON 的数据块直接跳过，页面上的图照样能存。
      }
    }
    return variants;
  }

  // 从同一文件的各尺寸里挑最大的：知道尺寸的看面积，不知道的看字段名提示，再按出现顺序。
  function biggestVariant(list) {
    let best = null;
    for (const item of list || []) {
      if (!best || item.size > best.size || (item.size === best.size && item.hint > best.hint)) {
        best = item;
      }
    }
    return best;
  }

  function extensionKind(url) {
    if (VIDEO_EXT.test(url)) {
      return "video";
    }
    return "image";
  }

  if (args && args.__test) {
    return { parseSrcset, largestCandidate, fileKey, upgradeUrl, biggestVariant, absolute };
  }

  const doc = document;
  const base = doc.baseURI;
  const referer = `${location.origin}/`;
  let variantCache = null;
  // 整帖里存不了的分片视频个数，保存完一起告诉用户。
  let skippedStreams = 0;
  const variants = () => (variantCache ||= embeddedVariants(doc, base));

  // 一张图能拿到的最大地址：srcset、<picture>、懒加载属性、外层指向图片的链接，再去页面数据和规则表里升档。
  function bestImageUrl(img) {
    const candidates = [];
    const current = absolute(img.currentSrc || img.src, base);
    const sets = [...parseSrcset(img.getAttribute("srcset"), base)];
    const picture = img.parentElement?.tagName === "PICTURE" ? img.parentElement : null;
    if (picture) {
      for (const source of picture.querySelectorAll("source")) {
        sets.push(...parseSrcset(source.getAttribute("srcset"), base));
      }
    }
    // 只写了 1x/2x 的档位换算成宽度再比：以当前显示的那一档为准，没对上就按显示宽度算 1x。
    const shown = sets.find((c) => c.url === current);
    const unit = shown && !shown.w && img.naturalWidth ? img.naturalWidth / shown.x : img.getBoundingClientRect().width || img.naturalWidth || 0;
    for (const candidate of sets) {
      candidates.push(candidate.w ? candidate : { ...candidate, w: Math.round(unit * candidate.x) });
    }
    if (current) {
      candidates.push({ url: current, w: img.naturalWidth || 0, x: 1 });
    }
    // data-original 这类属性明确指向原图，优先；data-src 只是懒加载用的同一张图，
    // 图还没加载（显示的是 1 像素占位图）时才用它。
    const lazy = img.naturalWidth > 1 ? 0 : Number.MAX_SAFE_INTEGER / 4;
    for (const [name, w] of [["data-original", Number.MAX_SAFE_INTEGER / 2], ["data-full", Number.MAX_SAFE_INTEGER / 2], ["data-large", Number.MAX_SAFE_INTEGER / 2], ["data-actualsrc", Number.MAX_SAFE_INTEGER / 2], ["data-origin", Number.MAX_SAFE_INTEGER / 2], ["data-src", lazy], ["data-lazy-src", lazy]]) {
      const url = absolute(img.getAttribute(name), base);
      if (url && isHttp(url)) {
        candidates.push({ url, w, x: 1 });
      }
    }
    const link = img.closest("a[href]");
    const linkUrl = link ? absolute(link.getAttribute("href"), base) : null;
    if (linkUrl && isHttp(linkUrl) && IMAGE_EXT.test(new URL(linkUrl).pathname)) {
      candidates.push({ url: linkUrl, w: Number.MAX_SAFE_INTEGER, x: 1 });
    }
    const chosen = largestCandidate(candidates.filter((c) => !/^data:image\/(gif|svg)/.test(c.url) || candidates.length === 1));
    if (!chosen) {
      return null;
    }
    let url = chosen.url;
    // 页面数据里同一张图更大的版本：只在确实比已选的更宽时才换，不能把 srcset 选出的大图换小。
    const bigger = biggestVariant(variants().get(fileKey(url)));
    if (bigger && bigger.width > chosen.w) {
      url = bigger.url;
    } else if (bigger && bigger.hint && !bigger.width && chosen.w <= (img.naturalWidth || 0)) {
      url = bigger.url;
    }
    return upgradeUrl(url);
  }

  // 测试用：直接算一张图的最大地址。
  if (args.__bestImage) {
    return bestImageUrl(args.__bestImage);
  }

  function videoUrl(video) {
    const urls = [video.currentSrc, video.src, ...[...video.querySelectorAll("source")].map((s) => s.src)]
      .map((u) => absolute(u, base))
      .filter(Boolean);
    const direct = urls.find(isHttp);
    if (direct) {
      return { url: direct };
    }
    // 播放器用的是分片流（blob:），看页面有没有声明 mp4 直链。
    const og = doc.querySelector('meta[property="og:video:secure_url"], meta[property="og:video:url"], meta[property="og:video"]');
    const ogUrl = og ? absolute(og.getAttribute("content"), base) : null;
    if (ogUrl && isHttp(ogUrl) && VIDEO_EXT.test(new URL(ogUrl).pathname)) {
      return { url: ogUrl };
    }
    return { stream: urls.length > 0 };
  }

  function backgroundUrl(element) {
    const value = getComputedStyle(element).backgroundImage;
    const match = value && value !== "none" ? /url\(["']?(.*?)["']?\)/.exec(value) : null;
    const url = match ? absolute(match[1], base) : null;
    return url && !url.startsWith("data:image/svg") ? upgradeUrl(url) : null;
  }

  function sameUrl(a, b) {
    return a && b && (a === b || decodeURI(a) === decodeURI(b));
  }

  function visibleArea(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect.width * rect.height : 0;
  }

  // 右键点到的元素：先用浏览器给的图片地址找，再看内容脚本记下的右键位置，最后看鼠标悬停的元素。
  function targetElement() {
    if (args.srcUrl) {
      const media = [...doc.querySelectorAll("img, video, source")].filter((el) =>
        sameUrl(absolute(el.currentSrc || el.src, base), args.srcUrl) || (el.getAttribute("srcset") || "").includes(args.srcUrl)
      );
      const element = media.map((el) => (el.tagName === "SOURCE" ? el.parentElement : el)).filter(Boolean);
      const hovered = element.find((el) => el.matches(":hover"));
      if (hovered || element[0]) {
        return hovered || element[0];
      }
    }
    const recorded = globalThis.__momentoContextTarget;
    if (recorded?.element?.isConnected && Date.now() - recorded.time < 60_000) {
      return recorded.element;
    }
    const hovered = [...doc.querySelectorAll(":hover")].pop();
    return hovered || null;
  }

  // 元素本身不是图（比如盖在图上的透明层），就在它附近找和它重叠、面积最大的图或视频。
  function mediaNear(element) {
    if (!element) {
      return null;
    }
    if (element.tagName === "IMG" || element.tagName === "VIDEO") {
      return element;
    }
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let node = element;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      let best = null;
      let bestArea = 0;
      for (const media of node.querySelectorAll("img, video")) {
        const r = media.getBoundingClientRect();
        const area = visibleArea(media);
        if (area > bestArea && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
          best = media;
          bestArea = area;
        }
      }
      if (best) {
        return best;
      }
    }
    return null;
  }

  function itemFromMedia(media) {
    if (media.tagName === "VIDEO") {
      const video = videoUrl(media);
      if (video.url) {
        return { url: video.url, kind: "video" };
      }
      if (video.stream) {
        return { error: "stream" };
      }
      return null;
    }
    const url = bestImageUrl(media);
    return url ? { url, kind: "image" } : null;
  }

  function genericSingle() {
    if (args.linkUrl && isHttp(args.linkUrl) && (IMAGE_EXT.test(new URL(args.linkUrl).pathname) || VIDEO_EXT.test(new URL(args.linkUrl).pathname))) {
      return [{ url: upgradeUrl(args.linkUrl), kind: extensionKind(new URL(args.linkUrl).pathname) }];
    }
    const target = targetElement();
    const media = mediaNear(target);
    if (media) {
      const item = itemFromMedia(media);
      if (item?.error) {
        throw Object.assign(new Error(item.error), { code: item.error });
      }
      if (item) {
        return [item];
      }
    }
    for (let el = target; el && el !== doc.body; el = el.parentElement) {
      const url = backgroundUrl(el);
      if (url) {
        return [{ url, kind: "image" }];
      }
    }
    if (args.srcUrl) {
      return [{ url: upgradeUrl(args.srcUrl), kind: args.mediaType === "video" ? "video" : "image" }];
    }
    return [];
  }

  // 元素外层几级容器的标签和类名。同一帖的图都套在一样的容器里，推荐区、头像的结构不同。
  function signature(media) {
    const parts = [];
    for (let node = media.parentElement, depth = 0; node && node !== doc.body && depth < 3; node = node.parentElement, depth += 1) {
      parts.push(`${node.tagName}.${[...node.classList].slice(0, 2).join(".")}`);
    }
    return parts.join(">");
  }

  function biggestVisibleMedia(scope) {
    let best = null;
    let bestArea = 0;
    for (const media of scope.querySelectorAll("img, video")) {
      const area = visibleArea(media);
      if (area > bestArea) {
        best = media;
        bestArea = area;
      }
    }
    return bestArea >= MIN_POST_SIZE * MIN_POST_SIZE ? best : null;
  }

  // 「这一帖全部」：以右键点到的图（没点在图上就用页面上最大的图）为准，收集结构相同的图和视频，
  // 懒加载还没显示出来的也算；有 article 就只在这一帖里找。
  function genericPost() {
    const target = targetElement();
    const anchor = mediaNear(target) || biggestVisibleMedia(doc.querySelector("main") || doc.body);
    if (!anchor) {
      return [];
    }
    const scope = anchor.closest("article, [role='article']") || doc;
    const shape = signature(anchor);
    const items = [];
    const keys = new Set();
    for (const media of scope.querySelectorAll("img, video")) {
      if (media !== anchor && signature(media) !== shape) {
        continue;
      }
      const item = itemFromMedia(media);
      if (item?.error === "stream") {
        skippedStreams += 1;
        continue;
      }
      const key = item?.url ? fileKey(item.url) || item.url : null;
      if (item && !keys.has(key)) {
        keys.add(key);
        items.push(item);
      }
    }
    return items;
  }

  // ---------- 平台专用：数据不在页面上、要调它自己接口才拿得到的 ----------

  function xiaohongshu() {
    const note = args.state;
    if (!note) {
      return null;
    }
    const items = [];
    const title = note.title || "";
    if (note.video) {
      // 视频笔记的图片列表只是封面，不另存。
      return [{ url: note.video, kind: "video", title }];
    }
    let images = note.images;
    if (!args.post) {
      // 单张：右键点到的那张；点在空白处就存轮播当前显示的那张。
      const shown = mediaNear(targetElement()) || doc.querySelector(".swiper-slide-active img");
      const key = fileKey(args.srcUrl || shown?.currentSrc || shown?.src || "");
      const index = images.findIndex((image) => fileKey(image.url) === key);
      images = index >= 0 ? [images[index]] : [];
    }
    for (const image of images) {
      items.push({ url: image.url, kind: "image", title });
      if (image.live) {
        items.push({ url: image.live, kind: "video", title });
      }
    }
    return items.length > 0 ? items : null;
  }

  function instagramShortcode() {
    const target = targetElement();
    const link = target?.closest("a[href*='/p/'], a[href*='/reel/']")?.getAttribute("href") || location.pathname;
    return /\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/.exec(link)?.[1] || null;
  }

  function instagramMediaId(shortcode) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let id = 0n;
    for (const ch of shortcode.slice(0, 11)) {
      id = id * 64n + BigInt(alphabet.indexOf(ch));
    }
    return id.toString();
  }

  function instagramBest(list) {
    const sorted = [...(list || [])].filter((c) => c?.url);
    sorted.sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0));
    return sorted[0]?.url || null;
  }

  function instagramItems(media) {
    const title = (media.caption?.text || "").split("\n")[0].slice(0, 120);
    const nodes = media.carousel_media?.length ? media.carousel_media : [media];
    return nodes
      .map((node) => {
        const video = instagramBest(node.video_versions);
        if (video) {
          return { url: video, kind: "video", title };
        }
        const image = instagramBest(node.image_versions2?.candidates);
        return image ? { url: image, kind: "image", title } : null;
      })
      .filter(Boolean);
  }

  async function instagram() {
    const shortcode = instagramShortcode();
    if (!shortcode) {
      return null;
    }
    let media = null;
    try {
      const response = await fetch(`/api/v1/media/${instagramMediaId(shortcode)}/info/`, {
        headers: { "X-IG-App-ID": "936619743392459" },
        credentials: "include"
      });
      if (response.ok) {
        media = (await response.json())?.items?.[0] || null;
      }
    } catch {
      media = null;
    }
    if (!media) {
      // 没登录时接口不给数据，退回页面内嵌的数据。
      for (const script of doc.querySelectorAll('script[type="application/json"]')) {
        const text = script.textContent || "";
        if (!text.includes(shortcode) || !text.includes("image_versions2")) {
          continue;
        }
        const walk = (node) => {
          if (!node || typeof node !== "object" || media) {
            return;
          }
          if (node.code === shortcode && (node.image_versions2 || node.video_versions)) {
            media = node;
            return;
          }
          Object.values(node).forEach(walk);
        };
        try {
          walk(JSON.parse(text));
        } catch {
          // 坏数据块跳过。
        }
      }
    }
    if (!media) {
      return null;
    }
    const items = instagramItems(media);
    if (args.post || items.length <= 1) {
      return items;
    }
    // 轮播里只存右键点到的那一张：按文件名对上，对不上就存当前显示的那张（找不到就交给通用规则）。
    // 视频元素的地址是 blob:，用它的封面图（poster）和轮播项的封面对上。
    const target = mediaNear(targetElement());
    const source = target?.tagName === "VIDEO" ? target.poster : target?.currentSrc || target?.src;
    const key = fileKey(source || "");
    const nodes = media.carousel_media || [];
    const index = key ? nodes.findIndex((node) => (node.image_versions2?.candidates || []).some((c) => fileKey(c.url) === key)) : -1;
    return index >= 0 ? [items[index]] : null;
  }

  async function pixiv() {
    const target = targetElement();
    const link = target?.closest("a[href*='/artworks/']")?.getAttribute("href") || location.pathname;
    const id = /\/artworks\/(\d+)/.exec(link)?.[1];
    if (!id) {
      return null;
    }
    const [info, pages] = await Promise.all([
      fetch(`/ajax/illust/${id}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/ajax/illust/${id}/pages`, { credentials: "include" }).then((r) => r.json())
    ]);
    if (pages.error || !Array.isArray(pages.body)) {
      return null;
    }
    const title = info?.body?.title || "";
    const items = pages.body
      .map((page) => page.urls?.original)
      .filter(Boolean)
      .map((url) => ({ url, kind: "image", referer: "https://www.pixiv.net/", title }));
    if (args.post) {
      return items;
    }
    const src = mediaNear(target)?.currentSrc || args.srcUrl || "";
    const page = /_p(\d+)/.exec(src)?.[1];
    return [items[page ? Number(page) : 0]].filter(Boolean);
  }

  async function weibo() {
    // 在某一帖里右键就用这一帖的链接；不在帖子里时只认当前地址，不去扫页面上别的帖子。
    const target = targetElement();
    const article = target?.closest("article");
    const links = article ? [...article.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")) : [location.pathname];
    const href = links.find((h) => /weibo\.com\/\d+\/[A-Za-z0-9]{9}|^\/\d+\/[A-Za-z0-9]{9}/.test(h));
    const id = href ? /\/\d+\/([A-Za-z0-9]{9})/.exec(href)?.[1] : null;
    if (!id) {
      return null;
    }
    const data = await fetch(`/ajax/statuses/show?id=${id}`, { credentials: "include" }).then((r) => r.json());
    const status = data?.pic_infos || data?.page_info ? data : data?.retweeted_status || data;
    const referer = "https://weibo.com/";
    const title = (status?.text_raw || "").split("\n")[0].slice(0, 120);
    const items = [];
    const pictures = status?.pic_infos || {};
    for (const pid of status?.pic_ids || Object.keys(pictures)) {
      const pic = pictures[pid];
      const url = pic?.largest?.url || pic?.original?.url || pic?.mw2000?.url;
      if (url) {
        items.push({ url, kind: "image", referer, title, pid });
      }
      if (pic?.type === "livephoto" && pic.video) {
        items.push({ url: pic.video, kind: "video", referer, title, pid });
      }
    }
    const media = status?.page_info?.media_info;
    if (media) {
      const playback = (media.playback_list || [])
        .map((p) => p.play_info)
        .filter((p) => p?.url)
        .sort((a, b) => (b.height || 0) - (a.height || 0))[0]?.url;
      const url = playback || media.mp4_720p_mp4 || media.mp4_hd_url || media.mp4_sd_url || media.stream_url_hd || media.stream_url;
      if (url) {
        items.push({ url, kind: "video", referer, title });
      }
    }
    if (args.post) {
      return items.map(({ pid, ...item }) => item);
    }
    const src = mediaNear(target)?.currentSrc || args.srcUrl || "";
    const key = fileKey(src);
    const picked = items.filter((item) => item.pid && item.pid.toLowerCase() === key);
    const chosen = picked.length > 0 ? picked : mediaNear(target)?.tagName === "VIDEO" ? items.filter((i) => i.kind === "video" && !i.pid) : [];
    return chosen.length > 0 ? chosen.map(({ pid, ...item }) => item) : null;
  }

  function formatOf(url) {
    try {
      const u = new URL(url);
      const ext = /\.([a-z0-9]{3,4})$/i.exec(u.pathname)?.[1] || u.searchParams.get("format") || u.searchParams.get("fm") || "";
      return ext.toLowerCase().replace("jpeg", "jpg");
    } catch {
      return "";
    }
  }

  // 整页：所有能存的图和视频，带缩略图、尺寸和格式，给批量保存面板用。
  function pageMedia() {
    const items = [];
    const seen = new Set();
    for (const media of doc.querySelectorAll("img, video")) {
      if (media.closest("#momento-panel-host")) {
        continue;
      }
      const item = itemFromMedia(media);
      if (!item || item.error || seen.has(item.url) || item.url.startsWith("data:image/svg") || /\.svg(?:$|[?#])/i.test(item.url)) {
        continue;
      }
      seen.add(item.url);
      const isVideo = media.tagName === "VIDEO";
      const srcsetWidth = isVideo ? 0 : largestCandidate(parseSrcset(media.getAttribute("srcset"), base))?.w || 0;
      const naturalWidth = isVideo ? media.videoWidth : media.naturalWidth;
      const naturalHeight = isVideo ? media.videoHeight : media.naturalHeight;
      // 懒加载还没显示的图只知道 srcset 里的宽度，高度留空。
      const width = Math.max(naturalWidth, srcsetWidth);
      const height = naturalWidth > 0 ? Math.round((naturalHeight * width) / naturalWidth) : 0;
      if (Math.min(width, height || width) < 16) {
        continue;
      }
      items.push({
        ...item,
        thumb: isVideo ? media.poster || "" : media.currentSrc || media.src,
        width,
        height,
        format: isVideo ? "video" : formatOf(item.url) || "img"
      });
    }
    return items;
  }

  if (args.page) {
    const items = pageMedia();
    for (const item of items) {
      item.referer = referer;
      item.upload = !isHttp(item.url);
    }
    return { items, pageUrl: location.href };
  }

  const host = location.hostname;
  const adapters = [
    [/(^|\.)xiaohongshu\.com$/, xiaohongshu],
    [/(^|\.)instagram\.com$/, instagram],
    [/(^|\.)pixiv\.net$/, pixiv],
    [/(^|\.)weibo\.com$/, weibo]
  ];
  try {
    const adapter = adapters.find(([pattern]) => pattern.test(host))?.[1];
    let items = null;
    if (adapter) {
      try {
        items = await adapter();
      } catch (error) {
        console.warn("Momento: 平台规则没取到，改用通用规则", error);
      }
    }
    if (!items || items.length === 0) {
      // 平台站点上找不到帖子时不能退回通用规则整页乱存。
      items = args.post ? (adapter ? [] : genericPost()) : genericSingle();
    }
    const seen = new Set();
    const unique = items.filter((item) => item?.url && !seen.has(item.url) && seen.add(item.url));
    for (const item of unique) {
      item.referer ||= referer;
      item.upload = !isHttp(item.url);
    }
    return { items: unique, error: unique.length === 0 ? (skippedStreams > 0 ? "stream" : "nothing") : null, skippedStreams, pageUrl: location.href };
  } catch (error) {
    return { items: [], error: error.code || "nothing", pageUrl: location.href };
  }
}

// 在页面主环境里读小红书当前笔记的数据（__INITIAL_STATE__ 只在主环境里能读到）。只取当前地址里那篇，
// 页面单页跳转后旧笔记的数据还留着，不能一起存进来。
// eslint-disable-next-line no-unused-vars
function momentoReadXiaohongshuNote() {
  // 个人页里打开的笔记地址是 /user/profile/<用户 ID>/<笔记 ID>，笔记 ID 是最后一个。
  const id = location.pathname.match(/[0-9a-f]{24}/gi)?.pop();
  const state = window.__INITIAL_STATE__;
  const map = state?.note?.noteDetailMap;
  const notes = map?._value || map?.value || map;
  const note = id && notes ? (notes[id]?.note || notes[id]) : null;
  if (!note || typeof note !== "object") {
    return null;
  }
  const https = (url) => (typeof url === "string" && url ? url.replace(/^\/\//, "https://").replace(/^http:\/\/([^/]*xhscdn\.com)\//, "https://$1/") : null);
  // 视频按分辨率取最大的一档，和页面播放器实际播放的一致。
  const bestStream = (stream) => {
    const all = Object.values(stream || {}).flat().filter((s) => s && (s.masterUrl || s.master_url));
    all.sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0) || (b.avgBitrate || 0) - (a.avgBitrate || 0));
    return https(all[0]?.masterUrl || all[0]?.master_url);
  };
  const images = (note.imageList || note.image_list || []).map((image) => {
    const infoList = image.infoList || image.info_list || [];
    const url = image.urlDefault || image.url_default || infoList.find((i) => (i.imageScene || i.image_scene) === "WB_DFT")?.url || infoList[0]?.url || image.url;
    return { url: https(url), live: image.livePhoto || image.live_photo ? bestStream(image.stream) : null };
  }).filter((image) => image.url);
  const video = note.type === "video" ? bestStream(note.video?.media?.stream) : null;
  return { title: note.title || "", images, video };
}

// 读 blob: 地址的内容（只能在它所在的页面里读），交回扩展上传给 Momento。
// eslint-disable-next-line no-unused-vars
async function momentoReadBlob(url, limit) {
  const response = await fetch(url);
  const blob = await response.blob();
  if (blob.size > limit) {
    return { error: "too_large" };
  }
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, buffer.subarray(i, i + 0x8000));
  }
  return { type: blob.type, data: btoa(binary) };
}
