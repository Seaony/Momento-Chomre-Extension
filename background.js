/* global momentoCollect, momentoReadXiaohongshuNote, momentoReadXVideos, momentoReadBlob, momentoToast, momentoPanel, momentoLoadLanguage, t */
importScripts("src/i18n.js", "src/collect.js", "src/ui.js");

const MOMENTO = "http://127.0.0.1:47641";
const MENU_SAVE = "momento-save";
const MENU_POST = "momento-save-post";
const MENU_PAGE = "momento-save-page";
const MENU_SHOT = "momento-save-screenshot";
// 能「保存这一帖全部」的帖子页。
const POST_PATTERNS = [
  "https://www.xiaohongshu.com/explore/*",
  "https://www.xiaohongshu.com/discovery/item/*",
  "https://www.xiaohongshu.com/user/profile/*/*",
  "https://www.instagram.com/*",
  "https://www.pixiv.net/*",
  "https://weibo.com/*",
  "https://x.com/*/status/*",
  "https://twitter.com/*/status/*",
  "https://*.pinterest.com/pin/*",
  "https://www.behance.net/gallery/*",
  "https://dribbble.com/shots/*",
  "https://huaban.com/pins/*",
  "https://www.zcool.com.cn/work/*",
  "https://www.artstation.com/artwork/*"
];
// 网页里读出来再上传的文件（blob:、data:）最大多少；再大扩展后台装不下。
const MAX_PAGE_FILE = 200 * 1024 * 1024;
const POLL_INTERVAL = 500;
const POLL_LIMIT = 30 * 60 * 1000;

// 后台每次被唤醒都先读一遍语言设置，用到文案的地方都等它读完。
let languageReady = loadLanguage();

function loadLanguage() {
  return momentoLoadLanguage()
    .then(() => chrome.action.setTitle({ title: t("actionTitle") }))
    .catch((error) => {
      console.error("Momento: 读取语言设置失败，先用浏览器语言", error);
    });
}

// 设置页换了语言：重新读文案，右键菜单跟着换。
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.language) {
    languageReady = loadLanguage();
    createMenus();
  }
});

async function createMenus() {
  await languageReady;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_SAVE, title: t("menuSave"), contexts: ["image", "video", "link", "page"] });
    chrome.contextMenus.create({ id: MENU_POST, title: t("menuSavePost"), contexts: ["image", "video", "link", "page"], documentUrlPatterns: POST_PATTERNS });
    chrome.contextMenus.create({ id: MENU_PAGE, title: t("menuSavePage"), contexts: ["page", "action"] });
    chrome.contextMenus.create({ id: MENU_SHOT, title: t("menuScreenshot"), contexts: ["page", "action"] });
  });
}

chrome.runtime.onInstalled.addListener(createMenus);
chrome.runtime.onStartup.addListener(createMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  languageReady.then(() => handleMenu(info, tab)).catch((error) => {
    console.error("Momento: 保存失败", error);
    showToast(tab?.id, t("errGeneric", error?.message || String(error)), "error");
  });
});

chrome.action.onClicked.addListener((tab) => {
  languageReady.then(() => openPanel(tab)).catch((error) => console.error("Momento: 打不开批量保存面板", error));
});

// 页面里发回来的：批量保存面板选好的图、帖子上「保存到 Momento」按钮的点击和它要显示的文字。
// 只接受本扩展的脚本发来的消息。
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !sender.tab?.id) {
    return false;
  }
  const tabId = sender.tab.id;
  const failed = (error) => {
    console.error("Momento: 保存失败", error);
    showToast(tabId, t("errGeneric", error?.message || String(error)), "error");
  };
  if (message?.type === "momento:save-items") {
    const items = Array.isArray(message.items) ? message.items.filter((item) => typeof item?.url === "string") : [];
    languageReady.then(() => saveItems(tabId, sender.frameId ?? 0, items, { pageUrl: sender.url || sender.tab.url, title: "" })).catch(failed);
  } else if (message?.type === "momento:save-post") {
    const pageUrl = sender.url || sender.tab.url;
    languageReady.then(() => collectAndSave(sender.tab, sender.frameId ?? 0, { srcUrl: null, linkUrl: null, mediaType: null, post: true }, pageUrl, pageUrl)).catch(failed);
  } else if (message?.type === "momento:post-button-text") {
    Promise.all([languageReady, postButtonIcon()])
      .then(([, icon]) => sendResponse({ label: t("menuSave"), title: t("postButtonTitle"), icon }))
      .catch((error) => {
        console.error("Momento: 读不到帖子按钮的图标", error);
        sendResponse(null);
      });
    return true;
  }
  return false;
});

async function handleMenu(info, tab) {
  if (!tab?.id) {
    return;
  }
  if (info.menuItemId === MENU_PAGE) {
    await openPanel(tab);
    return;
  }
  if (info.menuItemId === MENU_SHOT) {
    await saveScreenshot(tab);
    return;
  }
  await collectAndSave(tab, info.frameId ?? 0, {
    srcUrl: info.srcUrl || null,
    linkUrl: info.linkUrl || null,
    mediaType: info.mediaType || null,
    post: info.menuItemId === MENU_POST
  }, info.frameUrl || info.pageUrl || tab.url, info.pageUrl || tab.url);
}

// 帖子上保存按钮用的 Momento 图标，转成 data: 地址交给页面里的按钮。
let buttonIcon = null;
function postButtonIcon() {
  buttonIcon ||= fetch(chrome.runtime.getURL("icons/icon-128.png"))
    .then((response) => response.arrayBuffer())
    .then((buffer) => `data:image/png;base64,${btoa(String.fromCharCode(...new Uint8Array(buffer)))}`);
  return buttonIcon;
}

// 右键菜单和帖子上的按钮共用：在页面里找要存的东西，交给 Momento。
async function collectAndSave(tab, frameId, args, frameUrl, pageUrl) {
  // 取图要等网站接口（Instagram 慢时要一两秒），先告诉用户已经在存，免得以为没点上又点一次。
  await showToast(tab.id, t("saving"), "progress");
  const result = await collect(tab, frameId, args, frameUrl);
  if (result.error) {
    showToast(tab.id, reason(result.error), "error");
    return;
  }
  await saveItems(tab.id, frameId, result.items, { pageUrl: result.pageUrl || pageUrl, title: "", skippedStreams: result.skippedStreams || 0 });
}

// 截当前标签页的可见区域（点菜单时 activeTab 给了权限），当成网页里的文件上传给 Momento。
// 先截图再弹「保存中」的提示，不然提示会被截进去。
async function saveScreenshot(tab) {
  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch (error) {
    console.warn("Momento: 截图失败", error);
    await showToast(tab.id, t("errScreenshot"), "error");
    return;
  }
  // chrome:、file: 这类页面也能截，但 Momento 只收 http(s) 的来源地址，这时不带来源。
  const pageUrl = /^https?:/i.test(tab.url || "") ? tab.url : "";
  await saveItems(tab.id, 0, [{ url: dataUrl, kind: "image", upload: true, title: tab.title || "" }], { pageUrl, title: tab.title || "" });
}

async function inject(tabId, frameId, func, args, world = "ISOLATED") {
  const [first] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, func, args, world });
  return first?.result;
}

// 在点到的那个框架里找要保存的东西。注入不了（扩展商店、PDF、跨域框架）时，有图片地址就直接用。
async function collect(tab, frameId, args, frameUrl) {
  try {
    let state = null;
    if (/^https:\/\/([^/]+\.)?xiaohongshu\.com\//.test(frameUrl || "")) {
      state = await inject(tab.id, frameId, momentoReadXiaohongshuNote, [], "MAIN");
    } else if (/^https:\/\/(x|twitter)\.com\//.test(frameUrl || "")) {
      state = { xVideos: await inject(tab.id, frameId, momentoReadXVideos, [], "MAIN") };
    }
    const result = await inject(tab.id, frameId, momentoCollect, [{ ...args, state }]);
    if (result) {
      return result;
    }
  } catch (error) {
    console.warn("Momento: 无法读取页面，改用浏览器给的地址", error?.message || error);
  }
  const url = args.srcUrl || args.linkUrl;
  if (url && /^https?:/i.test(url)) {
    let referer = "";
    try {
      referer = `${new URL(frameUrl).origin}/`;
    } catch {
      referer = "";
    }
    return { items: [{ url, kind: args.mediaType === "video" ? "video" : "image", referer, upload: false }], pageUrl: frameUrl };
  }
  return { items: [], error: url ? "nothing" : "page" };
}

async function openPanel(tab) {
  if (!tab?.id) {
    return;
  }
  let result;
  try {
    const state = /^https:\/\/(x|twitter)\.com\//.test(tab.url || "") ? { xVideos: await inject(tab.id, 0, momentoReadXVideos, [], "MAIN") } : null;
    result = await inject(tab.id, 0, momentoCollect, [{ page: true, state }]);
  } catch (error) {
    console.warn("Momento: 这个页面不能打开批量保存", error?.message || error);
    showToast(tab.id, t("errPage"), "error");
    return;
  }
  const text = {
    title: t("panelTitle"), close: t("panelClose"), cancel: t("panelCancel"), invert: t("panelInvert"),
    anySize: t("panelAnySize"), minSize: t("panelMinSize", "$1"), video: t("panelVideo"),
    empty: t("panelEmpty"), emptyFiltered: t("panelEmptyFiltered"), found: t("panelFound", "$1"),
    selected: t("panelSelected", "$1"), selectAll: t("panelSelectAll"), selectNone: t("panelSelectNone"),
    save: t("panelSave"), saveCount: t("panelSaveCount", "$1")
  };
  await inject(tab.id, 0, momentoPanel, [{ items: result?.items || [], text }]);
}

// 页面里的提示；页面不能注入（扩展商店、PDF）就在工具栏图标上标一下。
async function showToast(tabId, text, tone) {
  if (!tabId) {
    return;
  }
  try {
    await inject(tabId, 0, momentoToast, [{ text, tone }]);
    return;
  } catch {
    // 落到下面的工具栏标记。
  }
  if (tone === "progress") {
    return;
  }
  await chrome.action.setBadgeBackgroundColor({ tabId, color: tone === "error" ? "#B91C1C" : "#1069DA" });
  await chrome.action.setBadgeText({ tabId, text: tone === "error" ? "!" : "✓" });
  await chrome.action.setTitle({ tabId, title: text });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
    chrome.action.setTitle({ tabId, title: t("actionTitle") }).catch(() => {});
  }, 6000);
}

function reason(code, message) {
  const keys = {
    unreachable: "errNotRunning", no_library: "errNoLibrary", remote_refused: "errRefused", download_failed: "errDownload",
    unsupported: "errUnsupported", too_large: "errTooLarge", canceled: "canceled", busy: "errBusy", not_ready: "errNotReady",
    stream: "errStream", nothing: "errNothing", page: "errPage", update: "errUpdate"
  };
  return keys[code] ? t(keys[code]) : t("errGeneric", message || code || "");
}

async function momentoStatus() {
  try {
    const response = await fetch(`${MOMENTO}/api/v1/status`);
    const body = await response.json();
    return body?.ok ? { capabilities: body.capabilities || null } : null;
  } catch {
    return null;
  }
}

async function readJSON(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function pageFile(tabId, frameId, item) {
  if (item.url.startsWith("data:")) {
    return (await fetch(item.url)).blob();
  }
  const result = await inject(tabId, frameId, momentoReadBlob, [item.url, MAX_PAGE_FILE]);
  if (!result || result.error) {
    throw Object.assign(new Error(result?.error || "read"), { code: result?.error === "too_large" ? "too_large" : "nothing" });
  }
  const binary = atob(result.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: result.type });
}

function fileName(item, type) {
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/avif": "avif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" }[type];
  return `${item.kind === "video" ? "video" : "image"}${extension ? `.${extension}` : ""}`;
}

// 交给 Momento 排队，返回任务号或失败原因。要上传的文件已经在 item.blob 里读好。
async function submit(item, meta) {
  const body = { pageUrl: meta.pageUrl || "", referer: item.referer || "", kind: item.kind || "image", title: item.title || meta.title || "", batchId: meta.batchId, index: meta.index, total: meta.total };
  let response;
  if (item.upload) {
    const blob = item.blob;
    const form = new FormData();
    form.append("meta", JSON.stringify(body));
    form.append("file", blob, fileName(item, blob.type));
    response = await fetch(`${MOMENTO}/api/v1/import/file`, { method: "POST", body: form });
  } else {
    response = await fetch(`${MOMENTO}/api/v1/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, url: item.url }) });
  }
  const json = await readJSON(response);
  if (!response.ok || !json.jobId) {
    return { done: true, ok: false, code: json.code, message: json.error || `HTTP ${response.status}` };
  }
  return { done: false, jobId: json.jobId };
}

// 旧版 Momento 没有任务队列：一张一张同步导入，只有第一张成功时让 Momento 提示。
async function saveLegacy(items, meta, onProgress) {
  const results = [];
  let feedback = true;
  for (const item of items) {
    if (item.upload) {
      results.push({ ok: false, code: "update" });
    } else {
      try {
        const response = await fetch(`${MOMENTO}/api/v1/import/image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: item.url, pageUrl: meta.pageUrl || "", playFeedback: feedback })
        });
        const json = await readJSON(response);
        results.push(response.ok ? { ok: true } : { ok: false, code: json.code, message: json.error || `HTTP ${response.status}` });
        feedback = feedback && !response.ok;
      } catch {
        results.push({ ok: false, code: "unreachable" });
      }
    }
    onProgress(results.length);
  }
  return results;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function saveItems(tabId, frameId, items, meta) {
  if (items.length === 0) {
    await showToast(tabId, t("errNothing"), "error");
    return;
  }
  const total = items.length;
  const progress = (done) => showToast(tabId, total === 1 ? t("saving") : t("savingCount", done, total), "progress");
  await progress(0);
  const status = await momentoStatus();
  if (!status) {
    await showToast(tabId, t("errNotRunning"), "error");
    return;
  }
  let results;
  if (!status.capabilities?.jobs) {
    results = await saveLegacy(items, meta, progress);
  } else {
    // 先把网页里的文件读出来，读不出来的直接记失败、不算进这一批：Momento 按这一批的总数等齐了才提示。
    results = [];
    const ready = [];
    for (const item of items) {
      if (!item.upload) {
        ready.push(item);
        continue;
      }
      try {
        ready.push({ ...item, blob: await pageFile(tabId, frameId, item) });
      } catch (error) {
        results.push({ done: true, ok: false, code: error.code || "nothing", message: error.message });
      }
    }
    const batchId = ready.length > 1 ? crypto.randomUUID() : "";
    for (const [index, item] of ready.entries()) {
      try {
        results.push(await submit(item, { ...meta, batchId, index, total: ready.length }));
      } catch (error) {
        results.push({ done: true, ok: false, code: error.code || "unreachable", message: error.message });
      }
    }
    const started = Date.now();
    let lastDone = -1;
    while (results.some((result) => !result.done) && Date.now() - started < POLL_LIMIT) {
      await sleep(POLL_INTERVAL);
      // 调一次扩展接口，让 Chrome 知道后台还在干活，不会在等 Momento 时把它停掉。
      await chrome.runtime.getPlatformInfo();
      for (const result of results.filter((r) => !r.done)) {
        try {
          const response = await fetch(`${MOMENTO}/api/v1/import/${result.jobId}`);
          const job = (await readJSON(response)).job;
          if (!response.ok || !job) {
            Object.assign(result, { done: true, ok: false, code: "unreachable" });
          } else if (job.state === "done" || job.state === "failed") {
            Object.assign(result, { done: true, ok: job.state === "done", code: job.code, message: job.error });
          }
        } catch {
          Object.assign(result, { done: true, ok: false, code: "unreachable" });
        }
      }
      const done = results.filter((r) => r.done).length;
      if (done !== lastDone && done < total) {
        lastDone = done;
        await progress(done);
      }
    }
    for (const result of results.filter((r) => !r.done)) {
      Object.assign(result, { done: true, ok: false, message: t("errTimeout") });
    }
  }
  const [text, tone] = summary(results);
  // 整帖里有分片视频没存上，接在结果后面说明。
  await showToast(tabId, meta.skippedStreams > 0 ? `${text} · ${t("skippedStreams", meta.skippedStreams)}` : text, meta.skippedStreams > 0 && tone === "success" ? "error" : tone);
}

function summary(results) {
  const saved = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok && r.code !== "canceled");
  if (saved === 0 && failed.length === 0) {
    return [t("canceled"), "info"];
  }
  if (failed.length === 0) {
    return [saved === 1 ? t("savedOne") : t("savedMany", saved), "success"];
  }
  const why = reason(failed[0].code, failed[0].message);
  if (saved === 0) {
    return [results.length === 1 ? why : t("failedMany", failed.length, why), "error"];
  }
  return [t("savedPartial", saved, failed.length, why), "error"];
}
