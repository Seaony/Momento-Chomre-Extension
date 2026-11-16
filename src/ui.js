// 注入到网页里的界面：保存提示和批量保存面板。两个函数都会被 chrome.scripting 注入页面，必须自成一体。
// 图标取自 Solar Icon Set（480 Design，CC BY 4.0），和 Momento 应用里用的同一套。

// 保存提示。args: { text, tone: "progress" | "success" | "error" | "info" }。进行中一直显示，结束后几秒自动消失。
// eslint-disable-next-line no-unused-vars
function momentoToast(args) {
  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none"><path d="M5.31171 10.7615C8.23007 5.58716 9.68925 3 12 3C14.3107 3 15.7699 5.58716 18.6883 10.7615L19.0519 11.4063C21.4771 15.7061 22.6897 17.856 21.5937 19.428C20.4978 21 17.7864 21 12.3637 21H11.6363C6.21356 21 3.50217 21 2.40626 19.428C1.31034 17.856 2.52291 15.7061 4.94805 11.4063L5.31171 10.7615Z" stroke="currentColor" stroke-width="1.5"/><path d="M12 8V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>',
    progress: '<span class="spin"></span>'
  };
  let host = document.getElementById("momento-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "momento-toast-host";
    host.style.cssText = "all: initial; position: fixed; top: 16px; right: 16px; z-index: 2147483647;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      .toast { display: flex; align-items: center; gap: 10px; max-width: 360px; padding: 10px 14px 10px 12px;
        border-radius: 10px; background: #FFFFFF; color: #1C1A29; border: 1px solid rgba(101, 83, 240, 0.14);
        box-shadow: 0 8px 28px rgba(28, 26, 41, 0.16); font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans", sans-serif;
        opacity: 0; transform: translateY(-6px); transition: opacity .18s ease, transform .18s ease; }
      .toast.show { opacity: 1; transform: none; }
      .icon { flex: none; width: 18px; height: 18px; display: grid; place-items: center; }
      .icon svg { width: 18px; height: 18px; }
      .info .icon { display: none; }
      .success .icon { color: #6553F0; }
      .error .icon { color: #D9483B; }
      .spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(101, 83, 240, 0.22); border-top-color: #6553F0; animation: spin .8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (prefers-color-scheme: dark) {
        .toast { background: #1E1C26; color: #F2F0FA; border-color: rgba(255, 255, 255, 0.08); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45); }
        .success .icon { color: #9A8CFF; }
        .error .icon { color: #FF7A6E; }
      }
    </style><div class="toast" role="status" aria-live="polite"><span class="icon"></span><span class="text"></span></div>`;
    (document.body || document.documentElement).appendChild(host);
  }
  const toast = host.shadowRoot.querySelector(".toast");
  toast.className = `toast ${args.tone}`;
  toast.querySelector(".icon").innerHTML = ICONS[args.tone] || "";
  toast.querySelector(".text").textContent = args.text;
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(host.__momentoTimer);
  if (args.tone !== "progress") {
    host.__momentoTimer = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => host.remove(), 200);
    }, args.tone === "error" ? 6000 : 3000);
  }
}

// 批量保存面板。args: { items, text }，items 来自 momentoCollect({ page: true })。
// 选好后把选中的项发回扩展后台保存，面板关掉。
// eslint-disable-next-line no-unused-vars
function momentoPanel(args) {
  document.getElementById("momento-panel-host")?.remove();
  const t = args.text;
  const items = args.items.map((item, index) => ({ ...item, index, selected: false }));
  const SIZES = [0, 200, 500, 1000];
  let minSize = 200;
  const formats = [...new Set(items.map((item) => item.format))].sort();
  const hiddenFormats = new Set();
  let anchor = null;

  const host = document.createElement("div");
  host.id = "momento-panel-host";
  host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host { color-scheme: light dark; }
    * { box-sizing: border-box; }
    .backdrop { position: fixed; inset: 0; background: rgba(20, 18, 32, 0.42); display: grid; place-items: center;
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans", sans-serif; }
    .sheet { width: min(980px, 94vw); height: min(720px, 90vh); display: flex; flex-direction: column; border-radius: 14px;
      background: #FCFBFF; color: #1C1A29; box-shadow: 0 24px 64px rgba(20, 18, 32, 0.28); overflow: hidden; }
    header { display: flex; align-items: center; gap: 12px; padding: 14px 16px 12px 20px; }
    h1 { font-size: 15px; font-weight: 600; margin: 0; }
    .count { color: #77738A; font-variant-numeric: tabular-nums; }
    .spacer { flex: 1; }
    .bar { display: flex; align-items: center; gap: 8px; padding: 0 20px 12px; flex-wrap: wrap; }
    button, select { font: inherit; color: inherit; height: 28px; border-radius: 8px; border: 1px solid rgba(101, 83, 240, 0.14);
      background: #F4F2FC; padding: 0 10px; cursor: pointer; }
    button:hover, select:hover { background: #ECE9FA; }
    button:focus-visible, select:focus-visible { outline: 2px solid #6553F0; outline-offset: 1px; }
    .cell:focus-visible { outline: 2px solid #9D99AE; outline-offset: 2px; }
    .chip[aria-pressed="false"] { background: transparent; color: #77738A; }
    .chip { text-transform: uppercase; font-size: 11px; letter-spacing: .02em; }
    .icon-button { width: 28px; padding: 0; display: grid; place-items: center; background: transparent; border-color: transparent; }
    .icon-button svg { width: 16px; height: 16px; }
    .grid { flex: 1; overflow: auto; padding: 4px 20px 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
      gap: 12px; align-content: start; }
    .cell { position: relative; border-radius: 10px; background: #F1EFF8; aspect-ratio: 1; overflow: hidden; cursor: pointer;
      border: 2px solid transparent; }
    .cell img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
    .cell.video::after { content: ""; position: absolute; inset: 0; margin: auto; width: 0; height: 0; border-left: 14px solid rgba(255,255,255,.92);
      border-top: 9px solid transparent; border-bottom: 9px solid transparent; filter: drop-shadow(0 1px 3px rgba(0,0,0,.4)); }
    .cell[aria-checked="true"] { border-color: #6553F0; }
    .mark { position: absolute; top: 8px; left: 8px; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,.9);
      background: rgba(20, 18, 32, 0.24); display: grid; place-items: center; color: #FFFFFF; }
    .mark svg { width: 14px; height: 14px; display: none; }
    .cell[aria-checked="true"] .mark { background: #6553F0; border-color: #6553F0; }
    .cell[aria-checked="true"] .mark svg { display: block; }
    .meta { position: absolute; left: 6px; right: 6px; bottom: 6px; display: flex; gap: 4px; justify-content: flex-end; }
    .meta span { padding: 1px 6px; border-radius: 6px; background: rgba(20, 18, 32, 0.62); color: #FFFFFF; font-size: 11px; font-variant-numeric: tabular-nums; }
    .empty { grid-column: 1 / -1; padding: 80px 0; text-align: center; color: #77738A; }
    footer { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-top: 1px solid rgba(101, 83, 240, 0.10); }
    .primary { background: #6553F0; border-color: #6553F0; color: #FFFFFF; padding: 0 14px; }
    .primary:hover { background: #6E5CF4; }
    .primary:disabled { opacity: .45; cursor: default; }
    @media (prefers-color-scheme: dark) {
      .sheet { background: #16151C; color: #F2F0FA; border: 1px solid rgba(255, 255, 255, 0.08); }
      .count, .empty, .chip[aria-pressed="false"] { color: #9D99AE; }
      button, select { background: #24222D; border-color: rgba(255, 255, 255, 0.08); }
      button:hover, select:hover { background: #2C2A37; }
      .icon-button { background: transparent; border-color: transparent; }
      .cell { background: #201F28; }
      footer { border-top-color: rgba(255, 255, 255, 0.06); }
      .primary { background: #6553F0; border-color: #6553F0; }
    }
  </style>
  <div class="backdrop">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="title">
      <header><h1 id="title"></h1><span class="count"></span><span class="spacer"></span>
        <button class="icon-button close" aria-label=""><svg viewBox="0 0 24 24" fill="none"><path d="M19 5L5 19M5 5l14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></header>
      <div class="bar"><select class="size"></select><span class="formats"></span><span class="spacer"></span>
        <button class="all"></button><button class="invert"></button></div>
      <div class="grid" role="listbox" aria-multiselectable="true"></div>
      <footer><span class="selected count"></span><span class="spacer"></span><button class="cancel"></button><button class="primary save"></button></footer>
    </div>
  </div>`;
  const $ = (selector) => root.querySelector(selector);
  $("#title").textContent = t.title;
  $(".close").setAttribute("aria-label", t.close);
  $(".cancel").textContent = t.cancel;
  $(".invert").textContent = t.invert;
  for (const size of SIZES) {
    const option = document.createElement("option");
    option.value = String(size);
    option.textContent = size === 0 ? t.anySize : t.minSize.replace("$1", size);
    option.selected = size === minSize;
    $(".size").appendChild(option);
  }
  for (const format of formats) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = format === "video" ? t.video : format;
    chip.setAttribute("aria-pressed", "true");
    chip.addEventListener("click", () => {
      hiddenFormats.has(format) ? hiddenFormats.delete(format) : hiddenFormats.add(format);
      chip.setAttribute("aria-pressed", String(!hiddenFormats.has(format)));
      render();
    });
    $(".formats").appendChild(chip);
  }

  const visible = () => items.filter((item) => !hiddenFormats.has(item.format) && Math.min(item.width, item.height || item.width) >= minSize);
  // 默认选中筛选后看得到的全部；筛掉的自动取消选中，免得存进看不见的图。
  const selectVisible = () => {
    const shown = new Set(visible());
    items.forEach((item) => (item.selected = shown.has(item)));
  };

  const check = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function render() {
    const shown = visible();
    const shownSet = new Set(shown);
    items.forEach((item) => {
      if (!shownSet.has(item)) {
        item.selected = false;
      }
    });
    const grid = $(".grid");
    grid.textContent = "";
    if (shown.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = items.length === 0 ? t.empty : t.emptyFiltered;
      grid.appendChild(empty);
    }
    for (const item of shown) {
      const cell = document.createElement("div");
      cell.className = item.kind === "video" ? "cell video" : "cell";
      cell.tabIndex = 0;
      cell.setAttribute("role", "option");
      cell.setAttribute("aria-checked", String(item.selected));
      if (item.thumb) {
        const img = document.createElement("img");
        img.src = item.thumb;
        img.loading = "lazy";
        img.alt = "";
        cell.appendChild(img);
      }
      cell.insertAdjacentHTML("beforeend", `<span class="mark">${check}</span><span class="meta"></span>`);
      const meta = cell.querySelector(".meta");
      for (const label of [item.width && item.height ? `${item.width} × ${item.height}` : item.width ? `${item.width} px` : "", item.format === "video" ? "" : item.format.toUpperCase()]) {
        if (label) {
          const span = document.createElement("span");
          span.textContent = label;
          meta.appendChild(span);
        }
      }
      const toggle = (event) => {
        // 按住 Shift 连选：从上次点的那张到这张，全部设成这张的新状态。
        const next = !item.selected;
        if (event.shiftKey && anchor !== null) {
          const from = shown.indexOf(anchor);
          const to = shown.indexOf(item);
          if (from >= 0) {
            shown.slice(Math.min(from, to), Math.max(from, to) + 1).forEach((other) => (other.selected = next));
          }
        }
        item.selected = next;
        anchor = item;
        render();
        // 只有键盘操作才把焦点放回这一格，鼠标点完不留焦点框，免得和「选中」的紫框混淆。
        if (event.type === "keydown") {
          root.querySelectorAll(".cell")[shown.indexOf(item)]?.focus();
        }
      };
      cell.addEventListener("click", toggle);
      cell.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          toggle(event);
        }
      });
      grid.appendChild(cell);
    }
    const selected = items.filter((item) => item.selected).length;
    $("header .count").textContent = t.found.replace("$1", shown.length);
    $(".selected").textContent = t.selected.replace("$1", selected);
    $(".all").textContent = selected === shown.length && shown.length > 0 ? t.selectNone : t.selectAll;
    $(".save").textContent = selected > 0 ? t.saveCount.replace("$1", selected) : t.save;
    $(".save").disabled = selected === 0;
  }

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    host.remove();
  };
  const onKey = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);
  $(".close").addEventListener("click", close);
  $(".cancel").addEventListener("click", close);
  $(".backdrop").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      close();
    }
  });
  $(".size").addEventListener("change", (event) => {
    minSize = Number(event.target.value);
    selectVisible();
    render();
  });
  $(".all").addEventListener("click", () => {
    const shown = visible();
    const all = shown.every((item) => item.selected);
    shown.forEach((item) => (item.selected = !all));
    render();
  });
  $(".invert").addEventListener("click", () => {
    visible().forEach((item) => (item.selected = !item.selected));
    render();
  });
  $(".save").addEventListener("click", () => {
    const chosen = items.filter((item) => item.selected).map(({ url, kind, referer, upload }) => ({ url, kind, referer, upload }));
    close();
    chrome.runtime.sendMessage({ type: "momento:save-items", items: chosen });
  });
  selectVisible();
  (document.body || document.documentElement).appendChild(host);
  render();
  $(".save").focus();
}
