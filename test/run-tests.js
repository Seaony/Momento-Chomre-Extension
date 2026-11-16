const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.resolve(__dirname, "..");
const plain = (value) => JSON.parse(JSON.stringify(value));
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

function testManifestAndFiles() {
  const manifest = JSON.parse(read("manifest.json"));
  assert.strictEqual(manifest.manifest_version, 3);
  assert.ok(manifest.key, "manifest 要带固定公钥，扩展 ID 才和 Momento 放行的一致");
  assert.deepStrictEqual(manifest.permissions, ["activeTab", "scripting", "contextMenus"]);
  assert.deepStrictEqual(manifest.host_permissions, ["http://127.0.0.1:47641/*"]);
  for (const file of [...Object.values(manifest.icons), manifest.background.service_worker, ...manifest.content_scripts.flatMap((c) => c.js)]) {
    assert.ok(fs.existsSync(path.join(rootDir, file)), `缺文件 ${file}`);
  }
  for (const match of read("background.js").matchAll(/importScripts\(([^)]*)\)/g)) {
    for (const file of match[1].split(",").map((s) => s.trim().replace(/"/g, ""))) {
      assert.ok(fs.existsSync(path.join(rootDir, file)), `缺文件 ${file}`);
    }
  }
}

function testLocalesMatch() {
  const locales = ["en", "zh_CN", "ja"].map((locale) => [locale, JSON.parse(read(`_locales/${locale}/messages.json`))]);
  const [, english] = locales[0];
  const used = new Set([...read("background.js").matchAll(/\bt\("([A-Za-z]+)"/g)].map((m) => m[1]));
  for (const name of ["extName", "extDescription", "actionTitle"]) {
    used.add(name);
  }
  for (const key of used) {
    assert.ok(english[key], `英文缺文案 ${key}`);
  }
  for (const [locale, messages] of locales) {
    assert.deepStrictEqual(Object.keys(messages).sort(), Object.keys(english).sort(), `${locale} 的文案 key 不齐`);
    for (const [key, { message }] of Object.entries(messages)) {
      const holders = (text) => [...text.matchAll(/\$\d/g)].map((m) => m[0]).sort().join();
      assert.strictEqual(holders(message), holders(english[key].message), `${locale}.${key} 的占位符和英文不一致`);
    }
  }
}

function loadCollect(globals = {}) {
  const context = { URL, console, ...globals };
  vm.createContext(context);
  vm.runInContext(read("src/collect.js"), context);
  return context;
}

async function testUrlRules() {
  const helpers = await loadCollect().momentoCollect({ __test: true });
  const { upgradeUrl, fileKey, parseSrcset, largestCandidate } = helpers;
  assert.strictEqual(upgradeUrl("https://pbs.twimg.com/media/Abc123.jpg?format=jpg&name=small"), "https://pbs.twimg.com/media/Abc123.jpg?format=jpg&name=orig");
  assert.strictEqual(upgradeUrl("https://img.zcool.cn/community/abc.jpg?x-oss-process=image/resize,w_1280&k=1&t=2"), "https://img.zcool.cn/community/abc.jpg?k=1&t=2");
  assert.strictEqual(upgradeUrl("https://cdn.dribbble.com/userupload/1/file/still-abc.png?format=webp&resize=400x300&vertical=center"), "https://cdn.dribbble.com/userupload/1/file/still-abc.png?format=webp");
  assert.strictEqual(upgradeUrl("https://gd-hbimg.huabanimg.com/abcdef123_fw240webp?auth_key=x"), "https://gd-hbimg.huabanimg.com/abcdef123?auth_key=x");
  assert.strictEqual(upgradeUrl("https://wx1.sinaimg.cn/orj360/abcdefgh.jpg"), "https://wx1.sinaimg.cn/large/abcdefgh.jpg");
  assert.strictEqual(upgradeUrl("https://i0.hdslb.com/bfs/archive/abc.jpg@672w_378h_1c.webp"), "https://i0.hdslb.com/bfs/archive/abc.jpg");
  // 带签名的地址一律不动。
  for (const url of ["https://scontent.cdninstagram.com/v/t51/123_456_n.jpg?stp=dst-jpg_s640x640&_nc_ht=x&oh=sig", "https://sns-webpic-qc.xhscdn.com/202611/abc!nd_dft_wlteh_webp_3"]) {
    assert.strictEqual(upgradeUrl(url), url);
  }
  assert.strictEqual(fileKey("https://mir-s3-cdn-cf.behance.net/project_modules/max_3840_webp/92c861257411721.6ad8c5ba8ecb4.jpg"), fileKey("https://mir-s3-cdn-cf.behance.net/project_modules/source/92c861257411721.6ad8c5ba8ecb4.jpg"));
  assert.strictEqual(fileKey("https://example.com/a.jpg"), null, "太短的文件名不拿来配对，免得配错");
  const best = largestCandidate(parseSrcset("https://i.pinimg.com/236x/a.jpg 1x, https://i.pinimg.com/474x/a.jpg 2x, https://i.pinimg.com/originals/a.jpg 4x", "https://www.pinterest.com/"));
  assert.strictEqual(best.url, "https://i.pinimg.com/originals/a.jpg");
  const byWidth = largestCandidate(parseSrcset("a.jpg?w=320,h=200 320w, b.jpg 1200w, c.jpg 800w", "https://example.com/"));
  assert.strictEqual(byWidth.url, "https://example.com/b.jpg");
}

function fakeImage({ src, srcset = null, naturalWidth = 0, naturalHeight = 0, width = 0, attrs = {} }) {
  return {
    currentSrc: src, src, naturalWidth, naturalHeight, parentElement: null,
    getAttribute: (name) => (name === "srcset" ? srcset : attrs[name] ?? null),
    getBoundingClientRect: () => ({ width }),
    closest: () => null
  };
}

async function testBestImageUrl() {
  const scripts = [];
  const context = loadCollect({
    location: { origin: "https://www.pinterest.com", href: "https://www.pinterest.com/" },
    document: { baseURI: "https://www.pinterest.com/", querySelectorAll: () => scripts }
  });
  const best = (img) => context.momentoCollect({ __bestImage: img });
  // 只写 1x/2x/4x 的 srcset：当前显示 474 宽的 2x，4x 那档更大。
  assert.strictEqual(await best(fakeImage({ src: "https://i.pinimg.com/474x/ab/cd/abcdef123456.jpg", naturalWidth: 474, width: 237,
    srcset: "https://i.pinimg.com/236x/ab/cd/abcdef123456.jpg 1x, https://i.pinimg.com/474x/ab/cd/abcdef123456.jpg 2x, https://i.pinimg.com/originals/ab/cd/abcdef123456.jpg 4x" })),
  "https://i.pinimg.com/originals/ab/cd/abcdef123456.jpg");
  // 逗号后面不带空格。
  assert.strictEqual(await best(fakeImage({ src: "https://example.com/small-photo.jpg", naturalWidth: 320, srcset: "small-photo.jpg 320w,large-photo.jpg 1600w" })), "https://www.pinterest.com/large-photo.jpg");
  // 页面数据里的版本比 srcset 选出来的小，不能换。
  scripts.push({ textContent: JSON.stringify({ image: { url: "https://cdn.example.com/1200/photo-123456.jpg", width: 1200, height: 800 } }) });
  assert.strictEqual(await best(fakeImage({ src: "https://cdn.example.com/640/photo-123456.jpg", naturalWidth: 640, srcset: "https://cdn.example.com/3000/photo-123456.jpg 3000w" })), "https://cdn.example.com/3000/photo-123456.jpg");
}

function testXiaohongshuReadsCurrentNoteOnly() {
  const stream = (width, url) => ({ width, height: width, avgBitrate: width, masterUrl: url });
  const notes = {
    "6af9a1cd000000002501e776": {
      note: {
        type: "normal",
        title: "当前笔记",
        imageList: [
          { urlDefault: "http://sns-webpic-qc.xhscdn.com/a!nd_dft", livePhoto: true, stream: { EF4: [stream(720, "https://v.xhscdn.com/live-720.mp4")], EF5: [stream(1080, "https://v.xhscdn.com/live-1080.mp4")] } },
          { infoList: [{ imageScene: "WB_PRV", url: "//sns-webpic-qc.xhscdn.com/b!prv" }, { imageScene: "WB_DFT", url: "//sns-webpic-qc.xhscdn.com/b!dft" }] }
        ]
      }
    },
    "6af0d3a2000000003301b8b1": { note: { type: "normal", title: "之前看过的", imageList: [{ urlDefault: "https://old" }] } }
  };
  const context = loadCollect({ location: { pathname: "/user/profile/5aa1b2c3d4e5f6a7b8c9d0e1/6af9a1cd000000002501e776" }, window: { __INITIAL_STATE__: { note: { noteDetailMap: { _value: notes } } } } });
  const note = JSON.parse(JSON.stringify(context.momentoReadXiaohongshuNote()));
  assert.deepStrictEqual(note, {
    title: "当前笔记",
    images: [
      { url: "https://sns-webpic-qc.xhscdn.com/a!nd_dft", live: "https://v.xhscdn.com/live-1080.mp4" },
      { url: "https://sns-webpic-qc.xhscdn.com/b!dft", live: null }
    ],
    video: null
  });
  notes["6af9a1cd000000002501e776"].note = { type: "video", title: "视频", imageList: [{ urlDefault: "https://cover" }], video: { media: { stream: { EF4: [stream(720, "https://v/720.mp4")], EF5: [stream(1080, "https://v/1080.mp4")] } } } };
  assert.strictEqual(context.momentoReadXiaohongshuNote().video, "https://v/1080.mp4");
}

// 后台脚本：用假的 chrome 和 fetch 跑一遍保存流程。
function loadBackground(routes) {
  const toasts = [];
  const requests = [];
  const chrome = {
    i18n: { getMessage: (key, subs) => [key, ...(subs || [])].join("|") },
    runtime: { id: "self", onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getPlatformInfo: async () => ({}) },
    contextMenus: { removeAll: (done) => done(), create() {}, onClicked: { addListener() {} } },
    action: { onClicked: { addListener() {} }, setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
    scripting: {
      executeScript: async ({ func, args }) => {
        if (func.name === "momentoToast") {
          toasts.push(args[0]);
          return [{ result: undefined }];
        }
        if (func.name === "momentoReadBlob") {
          return [{ result: { type: "image/png", data: Buffer.from("png").toString("base64") } }];
        }
        throw new Error(`没想到会注入 ${func.name}`);
      }
    }
  };
  const fetch = async (url, options = {}) => {
    requests.push({ url, options });
    const handler = routes(url, options, requests);
    if (handler instanceof Error) {
      throw handler;
    }
    const { status = 200, body = {} } = handler;
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  const context = {
    chrome, fetch, console, URL, Blob, FormData, atob, setTimeout: (fn) => setTimeout(fn, 0), crypto: { randomUUID: () => "batch-1" },
    importScripts() {}
  };
  vm.createContext(context);
  vm.runInContext(read("src/collect.js") + read("src/ui.js") + read("background.js"), context);
  return { context, toasts, requests };
}

async function testSaveUsesJobsAndPolls() {
  let polls = 0;
  const { context, toasts, requests } = loadBackground((url, options) => {
    if (url.endsWith("/api/v1/status")) {
      return { body: { ok: true, capabilities: { jobs: true, upload: true } } };
    }
    if (url.endsWith("/api/v1/import") && options.method === "POST") {
      const body = JSON.parse(options.body);
      return { status: 202, body: { ok: true, jobId: `job-${body.index}` } };
    }
    if (url.includes("/api/v1/import/job-")) {
      polls += 1;
      return { body: { ok: true, job: { state: polls > 2 ? "done" : "running" } } };
    }
    return { status: 404, body: {} };
  });
  await context.saveItems(7, 0, [
    { url: "https://example.com/a.jpg", kind: "image", referer: "https://example.com/" },
    { url: "https://example.com/b.mp4", kind: "video", referer: "https://example.com/", title: "标题" }
  ], { pageUrl: "https://example.com/post", title: "" });
  const posts = requests.filter((r) => r.options.method === "POST").map((r) => JSON.parse(r.options.body));
  assert.deepStrictEqual(posts.map((p) => [p.url, p.kind, p.batchId, p.index, p.total, p.title]), [
    ["https://example.com/a.jpg", "image", "batch-1", 0, 2, ""],
    ["https://example.com/b.mp4", "video", "batch-1", 1, 2, "标题"]
  ]);
  assert.strictEqual(posts[0].referer, "https://example.com/");
  assert.deepStrictEqual(plain(toasts.at(-1)), { text: "savedMany|2", tone: "success" });
  assert.ok(toasts.some((t) => t.tone === "progress"));
}

async function testSaveReportsReasons() {
  const notRunning = loadBackground(() => new Error("connection refused"));
  await notRunning.context.saveItems(1, 0, [{ url: "https://example.com/a.jpg", kind: "image" }], {});
  assert.deepStrictEqual(plain(notRunning.toasts.at(-1)), { text: "errNotRunning", tone: "error" });

  const noLibrary = loadBackground((url, options) => {
    if (url.endsWith("/api/v1/status")) {
      return { body: { ok: true, capabilities: { jobs: true } } };
    }
    if (options.method === "POST") {
      return { status: 202, body: { ok: true, jobId: "j" } };
    }
    return { body: { ok: true, job: { state: "failed", code: "no_library", error: "Open a library" } } };
  });
  await noLibrary.context.saveItems(1, 0, [{ url: "https://example.com/a.jpg", kind: "image" }], {});
  assert.deepStrictEqual(plain(noLibrary.toasts.at(-1)), { text: "errNoLibrary", tone: "error" });

  const partial = loadBackground((url, options) => {
    if (url.endsWith("/api/v1/status")) {
      return { body: { ok: true, capabilities: { jobs: true } } };
    }
    if (options.method === "POST") {
      return JSON.parse(options.body).index === 0 ? { status: 202, body: { ok: true, jobId: "ok" } } : { status: 400, body: { ok: false, code: "bad_request", error: "bad url" } };
    }
    return { body: { ok: true, job: { state: "done" } } };
  });
  await partial.context.saveItems(1, 0, [{ url: "https://a/1.jpg" }, { url: "https://a/2.jpg" }], {});
  assert.deepStrictEqual(plain(partial.toasts.at(-1)), { text: "savedPartial|1|1|errGeneric|bad url", tone: "error" });
}

async function testLegacyMomento() {
  const { context, toasts, requests } = loadBackground((url) => {
    if (url.endsWith("/api/v1/status")) {
      return { body: { ok: true, status: "ready" } };
    }
    return { body: { ok: true } };
  });
  await context.saveItems(1, 0, [{ url: "https://a/1.jpg" }, { url: "https://a/2.jpg" }, { url: "data:image/png;base64,AA==", upload: true }], { pageUrl: "https://a/" });
  const posts = requests.filter((r) => r.options.method === "POST");
  assert.deepStrictEqual(posts.map((r) => [r.url.replace(/^.*47641/, ""), JSON.parse(r.options.body).playFeedback]), [
    ["/api/v1/import/image", true],
    ["/api/v1/import/image", false]
  ]);
  assert.deepStrictEqual(plain(toasts.at(-1)), { text: "savedPartial|2|1|errUpdate", tone: "error" });
}

async function testUploadSendsFile() {
  const { context, toasts, requests } = loadBackground((url, options) => {
    if (url.endsWith("/api/v1/status")) {
      return { body: { ok: true, capabilities: { jobs: true, upload: true } } };
    }
    if (url.endsWith("/api/v1/import/file")) {
      return { status: 202, body: { ok: true, jobId: "f" } };
    }
    return { body: { ok: true, job: { state: "done" } } };
  });
  await context.saveItems(3, 2, [{ url: "blob:https://example.com/123", kind: "image", upload: true, referer: "https://example.com/" }], { pageUrl: "https://example.com/" });
  const upload = requests.find((r) => r.url.endsWith("/api/v1/import/file"));
  const form = upload.options.body;
  assert.ok(form instanceof FormData);
  assert.strictEqual(form.get("file").name, "image.png");
  assert.strictEqual(await form.get("file").text(), "png");
  assert.strictEqual(JSON.parse(form.get("meta")).pageUrl, "https://example.com/");
  assert.deepStrictEqual(plain(toasts.at(-1)), { text: "savedOne", tone: "success" });
}

function testPackageScriptShipsRuntimeFiles() {
  const script = read("scripts/package-extension.sh");
  for (const file of ["manifest.json", "background.js", "src", "_locales", "icons"]) {
    assert.ok(script.includes(file), `打包缺 ${file}`);
  }
  assert.ok(!/\btest\b/.test(script.split("zip -qr")[1] || ""), "测试不该打进包");
}

function testPrepareReleaseScriptPublishesGitHubRelease() {
  const scriptPath = path.join(rootDir, "scripts", "prepare-release.sh");
  const script = fs.readFileSync(scriptPath, "utf8");

  assert.ok(script.includes("Usage:"));
  assert.ok(script.includes("scripts/prepare-release.sh <version>"));
  assert.ok(script.includes("MOMENTO_CHROME_RELEASE_REPOSITORY"));
  assert.ok(script.includes("MOMENTO_CHROME_RELEASE_TAG"));
  assert.ok(script.includes("scripts/package-extension.sh"));
  assert.ok(script.includes("gh release create"));
  assert.ok(script.includes("git tag"));
  assert.ok(script.includes("git push origin"));
  assert.ok(script.includes("Momento-Image-Saver-Manual-Install"));
}

async function run() {
  testManifestAndFiles();
  testLocalesMatch();
  await testUrlRules();
  await testBestImageUrl();
  testXiaohongshuReadsCurrentNoteOnly();
  await testSaveUsesJobsAndPolls();
  await testSaveReportsReasons();
  await testLegacyMomento();
  await testUploadSendsFile();
  testPackageScriptShipsRuntimeFiles();
  testPrepareReleaseScriptPublishesGitHubRelease();
  console.log("All tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
