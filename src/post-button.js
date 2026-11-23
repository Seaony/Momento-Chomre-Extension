// 在小红书笔记详情（日期下面）和 Instagram 帖子（书签左边）放一个按钮，点一下把整帖存进 Momento。
// 按钮靠这两个网站的页面结构定位；网站改版后找不到位置就不放，右键「保存这一帖全部」照常能用。
(() => {
  const site = /(^|\.)xiaohongshu\.com$/.test(location.hostname) ? "xiaohongshu" : /(^|\.)instagram\.com$/.test(location.hostname) ? "instagram" : null;
  if (!site) {
    return;
  }
  const STYLE = `
    .momento-post-button { box-sizing: border-box; margin: 0; border: 0; color: inherit; font: inherit; cursor: pointer; }
    .momento-post-button img { display: block; flex: none; }
    .momento-post-button.instagram { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; background: none; }
    .momento-post-button.instagram img { width: 24px; height: 24px; }
    .momento-post-button.instagram:hover { opacity: .6; }
    .momento-post-button.xiaohongshu { display: inline-flex; align-items: center; gap: 6px; height: 32px; margin-top: 12px; padding: 0 14px;
      border-radius: 16px; background: rgba(128, 128, 128, .14); font-size: 14px; line-height: 1; }
    .momento-post-button.xiaohongshu img { width: 18px; height: 18px; }
    .momento-post-button.xiaohongshu:hover { background: rgba(128, 128, 128, .24); }
  `;
  // 按钮文字（跟扩展设置里的语言走）和 Momento 图标都由后台给：图标是 data: 地址，不用把扩展文件开放给网页。
  let text = null;

  async function loadText() {
    text = await chrome.runtime.sendMessage({ type: "momento:post-button-text" });
    for (const button of document.querySelectorAll(".momento-post-button")) {
      label(button);
    }
    scan();
  }

  function label(button) {
    button.title = text.title;
    button.setAttribute("aria-label", text.title);
    const span = button.querySelector("span");
    if (span) {
      span.textContent = text.label;
    }
  }

  function make() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `momento-post-button ${site}`;
    const icon = document.createElement("img");
    icon.src = text.icon;
    icon.alt = "";
    button.appendChild(icon);
    if (site === "xiaohongshu") {
      button.appendChild(document.createElement("span"));
    }
    label(button);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      // 后台取图时按这个元素找是哪一帖（Instagram 首页一屏有好几帖）。
      globalThis.__momentoContextTarget = { element: button, time: Date.now() };
      chrome.runtime.sendMessage({ type: "momento:save-post" }).catch((error) => console.error("Momento: 发不出保存请求", error));
    });
    return button;
  }

  function scanInstagram() {
    // 帖子操作栏：左边一组点赞、评论、转发、分享，右边一格只有书签。
    for (const section of document.querySelectorAll("section")) {
      const [actions, slot] = section.children;
      if (section.children.length !== 2 || slot.querySelector(".momento-post-button") || slot.querySelectorAll("svg").length !== 1 || actions.querySelectorAll("svg").length < 3) {
        continue;
      }
      Object.assign(slot.style, { display: "flex", alignItems: "center", gap: "16px" });
      slot.prepend(make());
    }
  }

  function scanXiaohongshu() {
    for (const row of document.querySelectorAll(".note-content > .bottom-container")) {
      if (!row.nextElementSibling?.classList.contains("momento-post-button")) {
        row.after(make());
      }
    }
  }

  function scan() {
    // 扩展被重新加载后，这个旧脚本已经和扩展断开，按钮点了也没用，撤掉；刷新页面后新脚本会重新放。
    if (!chrome.runtime?.id) {
      observer.disconnect();
      document.querySelectorAll(".momento-post-button").forEach((button) => button.remove());
      return;
    }
    if (text) {
      site === "instagram" ? scanInstagram() : scanXiaohongshu();
    }
  }

  // 两个网站都是单页应用，打开帖子、滚动信息流都不刷新页面，所以盯着页面变化补按钮。
  let queued = false;
  const observer = new MutationObserver(() => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        scan();
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.documentElement.appendChild(style);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.language) {
      loadText().catch((error) => console.error("Momento: 读不到按钮文字", error));
    }
  });
  loadText().catch((error) => console.error("Momento: 读不到按钮文字", error));
})();
