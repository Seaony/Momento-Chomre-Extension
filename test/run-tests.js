const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.resolve(__dirname, "..");

async function testXiaohongshuMenuReturnsAllImages() {
  const sentMessages = [];
  const injectedScripts = [];
  const context = {
    console,
    fetch,
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: { addListener() {} }
      },
      contextMenus: {
        create() {},
        removeAll(callback) {
          callback();
        },
        onClicked: { addListener() {} }
      },
      scripting: {
        executeScript(details, callback) {
          injectedScripts.push(details);
          callback([]);
        }
      },
      tabs: {
        sendMessage(tabId, message, callback) {
          sentMessages.push({ tabId, message });
          callback({
            images: [
              {
                url: "https://sns-webpic-qc.xhscdn.com/image-1",
                pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
              },
              {
                url: "https://sns-webpic-qc.xhscdn.com/image-2",
                pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
              }
            ]
          });
        }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    context
  );

  const requests = await context.importRequestsForMenuClick(
    {
      menuItemId: "save-xiaohongshu-note-images-to-momento",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    {
      id: 42,
      url: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    }
  );

  assert.strictEqual(injectedScripts[0].world, "MAIN");
  assert.deepStrictEqual(toPlainJson(sentMessages), [
    {
      tabId: 42,
      message: {
        type: "momento:get-xiaohongshu-note-images",
        preferPageImage: false
      }
    }
  ]);
  assert.deepStrictEqual(toPlainJson(requests), [
    {
      url: "https://sns-webpic-qc.xhscdn.com/image-1",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
      source: "unknown"
    },
    {
      url: "https://sns-webpic-qc.xhscdn.com/image-2",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
      source: "unknown"
    }
  ]);
}

async function testXiaohongshuMenuUsesInitialStateImagesBeforeDomFallback() {
  const sentMessages = [];
  const context = {
    console,
    fetch,
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: { addListener() {} }
      },
      contextMenus: {
        create() {},
        removeAll(callback) {
          callback();
        },
        onClicked: { addListener() {} }
      },
      scripting: {
        executeScript(details, callback) {
          assert.strictEqual(details.world, "MAIN");
          callback([
            {
              result: [
                "//sns-webpic-qc.xhscdn.com/original-from-state-1",
                "https://sns-webpic-qc.xhscdn.com/original-from-state-2"
              ]
            }
          ]);
        }
      },
      tabs: {
        sendMessage(tabId, message, callback) {
          sentMessages.push({ tabId, message });
          callback({ images: [] });
        }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    context
  );

  const requests = await context.importRequestsForMenuClick(
    {
      menuItemId: "save-xiaohongshu-note-images-to-momento",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    {
      id: 42,
      url: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    }
  );

  assert.deepStrictEqual(sentMessages, []);
  assert.deepStrictEqual(toPlainJson(requests), [
    {
      url: "https://sns-webpic-qc.xhscdn.com/original-from-state-1",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
      source: "original",
      index: 0
    },
    {
      url: "https://sns-webpic-qc.xhscdn.com/original-from-state-2",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
      source: "original",
      index: 1
    }
  ]);
}

function testXiaohongshuInitialStateExtractionPrefersDefaultImageUrl() {
  const context = {
    console,
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: { addListener() {} }
      },
      contextMenus: {
        create() {},
        removeAll(callback) {
          callback();
        },
        onClicked: { addListener() {} }
      }
    },
    window: {
      __INITIAL_STATE__: {
        note: {
          noteDetailMap: {
            one: {
              note: {
                imageList: [
                  {
                    infoList: [
                      { url: "//sns-webpic-qc.xhscdn.com/from-info-list" }
                    ],
                    urlDefault: "https://sns-webpic-qc.xhscdn.com/from-default"
                  },
                  {
                    infoList: [],
                    urlDefault: "https://sns-webpic-qc.xhscdn.com/default-only"
                  }
                ]
              }
            }
          }
        }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    context
  );

  assert.deepStrictEqual(toPlainJson(context.extractXiaohongshuImagesFromInitialState()), [
    "https://sns-webpic-qc.xhscdn.com/from-default",
    "https://sns-webpic-qc.xhscdn.com/default-only"
  ]);
}

function testXiaohongshuInitialStateExtractionUsesWbDftFromSnakeCaseFeed() {
  const context = {
    console,
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: { addListener() {} }
      },
      contextMenus: {
        create() {},
        removeAll(callback) {
          callback();
        },
        onClicked: { addListener() {} }
      }
    },
    window: {
      __INITIAL_STATE__: {
        data: {
          items: [
            {
              note_card: {
                image_list: [
                  {
                    url_default: "http://sns-webpic-qc.xhscdn.com/dft-from-url-default!nd_dft_wlteh_webp_3",
                    info_list: [
                      {
                        image_scene: "WB_PRV",
                        url: "http://sns-webpic-qc.xhscdn.com/preview!nd_prv_wlteh_webp_3"
                      },
                      {
                        image_scene: "WB_DFT",
                        url: "http://sns-webpic-qc.xhscdn.com/dft-from-info-list!nd_dft_wlteh_webp_3"
                      }
                    ]
                  },
                  {
                    info_list: [
                      {
                        image_scene: "WB_PRV",
                        url: "http://sns-webpic-qc.xhscdn.com/preview-only!nd_prv_wlteh_webp_3"
                      },
                      {
                        image_scene: "WB_DFT",
                        url: "http://sns-webpic-qc.xhscdn.com/dft-only!nd_dft_wgth_webp_3"
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    context
  );

  assert.deepStrictEqual(toPlainJson(context.extractXiaohongshuImagesFromInitialState()), [
    "https://sns-webpic-qc.xhscdn.com/dft-from-url-default!nd_dft_wlteh_webp_3",
    "https://sns-webpic-qc.xhscdn.com/dft-only!nd_dft_wgth_webp_3"
  ]);
}

function testXiaohongshuInitialStateExtractionRunsAsInjectedFunction() {
  const backgroundContext = {
    console,
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: { addListener() {} }
      },
      contextMenus: {
        create() {},
        removeAll(callback) {
          callback();
        },
        onClicked: { addListener() {} }
      }
    }
  };
  vm.createContext(backgroundContext);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    backgroundContext
  );

  const pageContext = {
    window: {
      __INITIAL_STATE__: {
        note: {
          noteDetailMap: {
            one: {
              note: {
                imageList: [
                  {
                    infoList: [
                      { url: "//sns-webpic-qc.xhscdn.com/from-injected-main-world" }
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    }
  };
  vm.createContext(pageContext);
  const injectedResult = vm.runInContext(
    `(${backgroundContext.extractXiaohongshuImagesFromInitialState.toString()})()`,
    pageContext
  );

  assert.deepStrictEqual(toPlainJson(injectedResult), [
    "https://sns-webpic-qc.xhscdn.com/from-injected-main-world"
  ]);
}

async function testXiaohongshuMenuInjectsContentScriptWhenMessageFails() {
  const sentMessages = [];
  const injectedScripts = [];
  let sendMessageCount = 0;
  const context = {
    console,
    fetch,
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: { addListener() {} }
      },
      contextMenus: {
        create() {},
        removeAll(callback) {
          callback();
        },
        onClicked: { addListener() {} }
      },
      scripting: {
        executeScript(details, callback) {
          injectedScripts.push(details);
          callback();
        }
      },
      tabs: {
        sendMessage(tabId, message, callback) {
          sendMessageCount += 1;
          sentMessages.push({ tabId, message });

          if (sendMessageCount === 1) {
            context.chrome.runtime.lastError = { message: "Receiving end does not exist." };
            callback();
            context.chrome.runtime.lastError = null;
            return;
          }

          callback({
            images: [
              {
                url: "https://sns-webpic.xhscdn.com/image-1?imageView2/2/w/0/format/jpg/v3",
                pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
              }
            ]
          });
        }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    context
  );

  const requests = await context.importRequestsForMenuClick(
    {
      menuItemId: "save-xiaohongshu-note-images-to-momento",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    {
      id: 42,
      url: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    }
  );

  assert.deepStrictEqual(toPlainJson(injectedScripts).filter((details) => details.files), [
    {
      target: { tabId: 42 },
      files: ["xiaohongshu-content.js"]
    }
  ]);
  assert.strictEqual(sentMessages.length, 2);
  assert.deepStrictEqual(toPlainJson(requests), [
    {
      url: "https://sns-webpic.xhscdn.com/image-1?imageView2/2/w/0/format/jpg/v3",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
      source: "unknown"
    }
  ]);
}

function testContextMenusIncludeXiaohongshuNativePageMenu() {
  const createdMenus = [];
  const context = {
    console,
    fetch,
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: { addListener() {} }
      },
      contextMenus: {
        create(menu) {
          createdMenus.push(menu);
        },
        removeAll(callback) {
          callback();
        },
        onClicked: { addListener() {} }
      },
      tabs: {
        sendMessage() {}
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    context
  );

  context.createContextMenus();

  assert.deepStrictEqual(toPlainJson(createdMenus).find((menu) => menu.id === "save-xiaohongshu-note-images-to-momento"), {
    id: "save-xiaohongshu-note-images-to-momento",
    title: "Save All Images to Momento",
    contexts: ["page", "image"],
    documentUrlPatterns: [
      "https://xiaohongshu.com/explore/*",
      "https://www.xiaohongshu.com/explore/*"
    ]
  });
}

async function testRuntimeMessageImportsImageBatch() {
  const fetchCalls = [];
  let messageListener = null;
  const context = {
    console,
    fetch(_url, options) {
      fetchCalls.push(JSON.parse(options.body));
      return Promise.resolve({
        ok: true
      });
    },
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: {
          addListener(listener) {
            messageListener = listener;
          }
        }
      },
      contextMenus: {
        create() {},
        removeAll(callback) {
          callback();
        },
        onClicked: { addListener() {} }
      },
      tabs: {
        sendMessage() {}
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    context
  );

  const response = await new Promise((resolve) => {
    const keepAlive = messageListener(
      {
        type: "momento:import-images",
        images: [
          {
            url: "https://sns-webpic-qc.xhscdn.com/image-1",
            pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
          },
          {
            url: "https://sns-webpic-qc.xhscdn.com/image-2",
            pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
          }
        ]
      },
      {},
      resolve
    );

    assert.strictEqual(keepAlive, true);
  });

  assert.deepStrictEqual(toPlainJson(response), { imported: 2 });
  assert.deepStrictEqual(fetchCalls, [
    {
      url: "https://sns-webpic-qc.xhscdn.com/image-1",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    {
      url: "https://sns-webpic-qc.xhscdn.com/image-2",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
      playFeedback: false
    }
  ]);
}

async function testImageBatchRequestsFeedbackUntilFirstSuccess() {
  const fetchCalls = [];
  let messageListener = null;
  const context = {
    console,
    fetch(_url, options) {
      const request = JSON.parse(options.body);
      fetchCalls.push(request);
      if (request.url.endsWith("image-1")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text() {
            return Promise.resolve("failed");
          }
        });
      }

      return Promise.resolve({ ok: true });
    },
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: {
          addListener(listener) {
            messageListener = listener;
          }
        }
      },
      contextMenus: {
        create() {},
        removeAll(callback) {
          callback();
        },
        onClicked: { addListener() {} }
      },
      tabs: {
        sendMessage() {}
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    context
  );

  await new Promise((resolve) => {
    messageListener(
      {
        type: "momento:import-images",
        images: [
          { url: "https://sns-webpic-qc.xhscdn.com/image-1" },
          { url: "https://sns-webpic-qc.xhscdn.com/image-2" },
          { url: "https://sns-webpic-qc.xhscdn.com/image-3" }
        ]
      },
      {},
      resolve
    );
  });

  assert.deepStrictEqual(fetchCalls, [
    {
      url: "https://sns-webpic-qc.xhscdn.com/image-1",
      pageUrl: null
    },
    {
      url: "https://sns-webpic-qc.xhscdn.com/image-2",
      pageUrl: null
    },
    {
      url: "https://sns-webpic-qc.xhscdn.com/image-3",
      pageUrl: null,
      playFeedback: false
    }
  ]);
}

async function testXiaohongshuContextMenuReportsImportStatusToPage() {
  let clickListener = null;
  let statusMessageAttempts = 0;
  const injectedScripts = [];
  const statusMessages = [];
  const context = {
    console,
    fetch() {
      return Promise.resolve({
        ok: false,
        status: 422,
        statusText: "Unprocessable Content",
        text() {
          return Promise.resolve("download failed");
        }
      });
    },
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: { addListener() {} }
      },
      contextMenus: {
        create() {},
        removeAll(callback) {
          callback();
        },
        onClicked: {
          addListener(listener) {
            clickListener = listener;
          }
        }
      },
      scripting: {
        executeScript(details, callback) {
          injectedScripts.push(details);
          callback([]);
        }
      },
      tabs: {
        sendMessage(_tabId, message, callback) {
          if (message.type === "momento:get-xiaohongshu-note-images") {
            callback({
              images: [
                {
                  url: "https://sns-webpic.xhscdn.com/missing?imageView2/2/w/0/format/jpg/v3",
                  pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
                }
              ]
            });
            return;
          }

          statusMessageAttempts += 1;
          if (statusMessageAttempts === 1) {
            context.chrome.runtime.lastError = { message: "Receiving end does not exist." };
            callback?.();
            context.chrome.runtime.lastError = null;
            return;
          }

          statusMessages.push(message);
          callback?.();
        }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    context
  );

  await clickListener(
    {
      menuItemId: "save-xiaohongshu-note-images-to-momento",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    {
      id: 42,
      url: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    }
  );

  assert.deepStrictEqual(toPlainJson(injectedScripts).filter((details) => details.files), [
    {
      target: { tabId: 42 },
      files: ["xiaohongshu-content.js"]
    }
  ]);
  assert.deepStrictEqual(toPlainJson(statusMessages), [
    {
      type: "momento:import-status",
      requested: 1,
      imported: 0,
      sourceSummary: {
        original: 0,
        fallback: 0,
        unknown: 0
      },
      failures: [
        {
          url: "https://sns-webpic.xhscdn.com/missing?imageView2/2/w/0/format/jpg/v3",
          source: "unknown",
          error: "HTTP 422 Unprocessable Content: download failed"
        }
      ]
    }
  ]);
}

async function testXiaohongshuRetriesFallbackWhenOriginalImportFails() {
  let clickListener = null;
  const fetchCalls = [];
  const statusMessages = [];
  const context = {
    console,
    fetch(_url, options) {
      const request = JSON.parse(options.body);
      fetchCalls.push(request);
      if (request.url === "https://sns-webpic-qc.xhscdn.com/original-from-state-1") {
        return Promise.resolve({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          text() {
            return Promise.resolve("cdn denied");
          }
        });
      }

      return Promise.resolve({
        ok: true
      });
    },
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: { addListener() {} }
      },
      contextMenus: {
        create() {},
        removeAll(callback) {
          callback();
        },
        onClicked: {
          addListener(listener) {
            clickListener = listener;
          }
        }
      },
      scripting: {
        executeScript(details, callback) {
          if (details.world === "MAIN") {
            callback([
              {
                result: ["https://sns-webpic-qc.xhscdn.com/original-from-state-1"]
              }
            ]);
            return;
          }

          callback([]);
        }
      },
      tabs: {
        sendMessage(_tabId, message, callback) {
          if (message.type === "momento:get-xiaohongshu-note-images") {
            assert.strictEqual(message.preferPageImage, true);
            callback({
              images: [
                {
                  url: "https://sns-webpic-qc.xhscdn.com/page-fallback-1",
                  pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
                  source: "fallback",
                  index: 0
                }
              ]
            });
            return;
          }

          statusMessages.push(message);
          callback?.();
        }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    context
  );

  await clickListener(
    {
      menuItemId: "save-xiaohongshu-note-images-to-momento",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    {
      id: 42,
      url: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    }
  );

  assert.deepStrictEqual(fetchCalls, [
    {
      url: "https://sns-webpic-qc.xhscdn.com/original-from-state-1",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    {
      url: "https://sns-webpic-qc.xhscdn.com/page-fallback-1",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    }
  ]);
  assert.deepStrictEqual(toPlainJson(statusMessages), [
    {
      type: "momento:import-status",
      requested: 1,
      imported: 1,
      sourceSummary: {
        original: 0,
        fallback: 1,
        unknown: 0
      },
      failures: [],
      retriedWithFallback: true
    }
  ]);
}

async function testXiaohongshuKeepsOriginalFailuresWithoutFallbackRetry() {
  let clickListener = null;
  const statusMessages = [];
  const context = {
    console,
    fetch(_url, options) {
      const request = JSON.parse(options.body);
      if (request.url === "https://sns-webpic-qc.xhscdn.com/page-fallback-1") {
        return Promise.resolve({ ok: true });
      }

      return Promise.resolve({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text() {
          return Promise.resolve("cdn denied");
        }
      });
    },
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: { addListener() {} }
      },
      contextMenus: {
        create() {},
        removeAll(callback) {
          callback();
        },
        onClicked: {
          addListener(listener) {
            clickListener = listener;
          }
        }
      },
      scripting: {
        executeScript(details, callback) {
          if (details.world === "MAIN") {
            callback([
              {
                result: [
                  "https://sns-webpic-qc.xhscdn.com/original-from-state-1",
                  "https://sns-webpic-qc.xhscdn.com/original-from-state-2"
                ]
              }
            ]);
            return;
          }

          callback([]);
        }
      },
      tabs: {
        sendMessage(_tabId, message, callback) {
          if (message.type === "momento:get-xiaohongshu-note-images") {
            callback({
              images: [
                {
                  url: "https://sns-webpic-qc.xhscdn.com/page-fallback-1",
                  pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
                  source: "fallback",
                  index: 0
                }
              ]
            });
            return;
          }

          statusMessages.push(message);
          callback?.();
        }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    context
  );

  await clickListener(
    {
      menuItemId: "save-xiaohongshu-note-images-to-momento",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    {
      id: 42,
      url: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    }
  );

  assert.deepStrictEqual(toPlainJson(statusMessages), [
    {
      type: "momento:import-status",
      requested: 2,
      imported: 1,
      sourceSummary: {
        original: 0,
        fallback: 1,
        unknown: 0
      },
      failures: [
        {
          url: "https://sns-webpic-qc.xhscdn.com/original-from-state-2",
          source: "original",
          error: "HTTP 403 Forbidden: cdn denied",
          index: 1
        }
      ],
      retriedWithFallback: true
    }
  ]);
}

async function testXiaohongshuDoesNotRetryOriginalWhenPageImageMatches() {
  let clickListener = null;
  const fetchCalls = [];
  const statusMessages = [];
  const imageUrl = "https://sns-webpic-qc.xhscdn.com/same-image!nd_dft_wlteh_webp_3";
  const context = {
    console,
    fetch(_url, options) {
      const request = JSON.parse(options.body);
      fetchCalls.push(request);
      return Promise.resolve({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text() {
          return Promise.resolve("cdn denied");
        }
      });
    },
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onMessage: { addListener() {} }
      },
      contextMenus: {
        create() {},
        removeAll(callback) {
          callback();
        },
        onClicked: {
          addListener(listener) {
            clickListener = listener;
          }
        }
      },
      scripting: {
        executeScript(details, callback) {
          if (details.world === "MAIN") {
            callback([
              {
                result: [imageUrl]
              }
            ]);
            return;
          }

          callback([]);
        }
      },
      tabs: {
        sendMessage(_tabId, message, callback) {
          if (message.type === "momento:get-xiaohongshu-note-images") {
            callback({
              images: [
                {
                  url: imageUrl,
                  pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
                  source: "original",
                  index: 0
                }
              ]
            });
            return;
          }

          statusMessages.push(message);
          callback?.();
        }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "background.js"), "utf8"),
    context
  );

  await clickListener(
    {
      menuItemId: "save-xiaohongshu-note-images-to-momento",
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    {
      id: 42,
      url: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    }
  );

  assert.deepStrictEqual(fetchCalls, [
    {
      url: imageUrl,
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    }
  ]);
  assert.deepStrictEqual(toPlainJson(statusMessages), [
    {
      type: "momento:import-status",
      requested: 1,
      imported: 0,
      sourceSummary: {
        original: 0,
        fallback: 0,
        unknown: 0
      },
      failures: [
        {
          url: imageUrl,
          source: "original",
          error: "HTTP 403 Forbidden: cdn denied",
          index: 0
        }
      ]
    }
  ]);
}

async function testXiaohongshuSliderExtractionDedupesDuplicateSlides() {
  const firstDisplayUrl = "https://sns-webpic-qc.xhscdn.com/202605261226/34fb6b2db11b6db1dc7cb91106d80aa7/1040g008313dieqdlg20049uufc3mgp4vu1kanpg!nd_dft_wlteh_webp_3";
  const secondDisplayUrl = "https://sns-webpic-qc.xhscdn.com/202605261226/f7df376ac40a63a8be2115d10bde049f/1040g008313dp0gpcnq0049uufc3mgp4vj9pqki0!nd_dft_wgth_webp_3";
  const context = {
    console,
    location: {
      href: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    chrome: {
      runtime: {
        onMessage: { addListener() {} }
      }
    },
    Element: function Element() {}
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "xiaohongshu-content.js"), "utf8"),
    context
  );

  const slides = [
    slide("7", "https://sns-webpic-qc.xhscdn.com/202605261226/90a251c18efa65580c19a24df1cd74ca/1040g008313dp0gpcnq3049uufc3mgp4v11gpg2g!nd_dft_wlteh_webp_3", true),
    slide("0", firstDisplayUrl, false),
    slide("1", secondDisplayUrl, false),
    slide("0", firstDisplayUrl, true)
  ];
  const fakeDocument = {
    querySelectorAll(selector) {
      return selector === ".note-slider .swiper-slide" ? slides : [];
    }
  };

  assert.deepStrictEqual(
    toPlainJson(await context.xiaohongshuNoteImagesFromDocument(fakeDocument, {
      verifyImageUrl() {
        return Promise.resolve(true);
      }
    })),
    [
      {
        url: firstDisplayUrl,
        pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
        source: "original",
        index: 0
      },
      {
        url: secondDisplayUrl,
        pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
        source: "original",
        index: 1
      }
    ]
  );
}

function testXiaohongshuImageUrlSourceMarksDftAsOriginal() {
  const context = {
    console,
    location: {
      href: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    chrome: {
      runtime: {
        onMessage: { addListener() {} }
      }
    },
    Element: function Element() {}
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "xiaohongshu-content.js"), "utf8"),
    context
  );

  assert.strictEqual(
    context.xiaohongshuImageUrlSource("https://sns-webpic-qc.xhscdn.com/image!nd_dft_wlteh_webp_3"),
    "original"
  );
  assert.strictEqual(
    context.xiaohongshuImageUrlSource("https://sns-webpic-qc.xhscdn.com/image!nd_prv_wlteh_webp_3"),
    "fallback"
  );
}

async function testXiaohongshuKeepsDftPageImageUrlAsOriginal() {
  const displayUrl = "https://sns-webpic-qc.xhscdn.com/202605261226/34fb6b2db11b6db1dc7cb91106d80aa7/1040g008313dieqdlg20049uufc3mgp4vu1kanpg!nd_dft_wlteh_webp_3";
  const context = {
    console,
    location: {
      href: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    chrome: {
      runtime: {
        onMessage: { addListener() {} }
      }
    },
    Element: function Element() {}
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "xiaohongshu-content.js"), "utf8"),
    context
  );

  const result = await context.xiaohongshuNoteImagesFromDocument(
    {
      querySelectorAll(selector) {
        return selector === ".note-slider .swiper-slide" ? [slide("0", displayUrl, false)] : [];
      }
    },
    {
      verifyImageUrl() {
        return Promise.resolve(false);
      }
    }
  );

  assert.deepStrictEqual(toPlainJson(result), [
    {
      url: displayUrl,
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
      source: "original",
      index: 0
    }
  ]);
}

async function testXiaohongshuPreferPageImageKeepsDftUrlWithIndex() {
  const displayUrl = "https://sns-webpic-qc.xhscdn.com/202605261226/34fb6b2db11b6db1dc7cb91106d80aa7/1040g008313dieqdlg20049uufc3mgp4vu1kanpg!nd_dft_wlteh_webp_3";
  const context = {
    console,
    location: {
      href: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    chrome: {
      runtime: {
        onMessage: { addListener() {} }
      }
    },
    Element: function Element() {}
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "xiaohongshu-content.js"), "utf8"),
    context
  );

  const result = await context.xiaohongshuNoteImagesFromDocument(
    {
      querySelectorAll(selector) {
        return selector === ".note-slider .swiper-slide" ? [slide("3", displayUrl, false)] : [];
      }
    },
    {
      preferPageImage: true,
      verifyImageUrl() {
        throw new Error("preferPageImage should not verify high-quality URLs");
      }
    }
  );

  assert.deepStrictEqual(toPlainJson(result), [
    {
      url: displayUrl,
      pageUrl: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56",
      source: "original",
      index: 3
    }
  ]);
}

function testXiaohongshuContentScriptLogsExtractionErrors() {
  let messageListener = null;
  const errors = [];
  const context = {
    console: {
      info() {},
      warn() {},
      error(...args) {
        errors.push(args);
      }
    },
    document: {
      querySelectorAll() {
        throw new Error("broken slider");
      }
    },
    location: {
      href: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener(listener) {
            messageListener = listener;
          }
        }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "xiaohongshu-content.js"), "utf8"),
    context
  );

  let response = null;
  const keepAlive = messageListener(
    { type: "momento:get-xiaohongshu-note-images" },
    {},
    (value) => {
      response = value;
    }
  );

  assert.strictEqual(keepAlive, true);
  return new Promise((resolve) => {
    setTimeout(() => {
      assert.strictEqual(response.images.length, 0);
      assert.match(response.error, /broken slider/);
      assert.match(errors[0][0], /Momento Xiaohongshu image extraction failed/);
      resolve();
    }, 0);
  });
}

function testXiaohongshuContentScriptShowsImportStatusToast() {
  let messageListener = null;
  const warnings = [];
  const fakeDocument = fakeXiaohongshuDocument([]);
  const context = {
    console: {
      info() {},
      warn(...args) {
        warnings.push(args);
      },
      error() {}
    },
    document: fakeDocument,
    location: {
      href: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener(listener) {
            messageListener = listener;
          }
        }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "xiaohongshu-content.js"), "utf8"),
    context
  );

  const keepAlive = messageListener(
    {
      type: "momento:import-status",
      requested: 1,
      imported: 0,
      sourceSummary: {
        original: 0,
        fallback: 0,
        unknown: 0
      },
      failures: [
        {
          url: "https://sns-webpic.xhscdn.com/missing?imageView2/2/w/0/format/jpg/v3",
          source: "unknown",
          error: "HTTP 422 Unprocessable Content: download failed"
        }
      ]
    },
    {},
    () => {}
  );

  assert.strictEqual(keepAlive, false);
  assert.match(warnings[0][0], /Momento Xiaohongshu import finished with failures/);
  assert.strictEqual(fakeDocument.body.children.length, 1);
  assert.match(fakeDocument.body.children[0].textContent, /保存失败/);
  assert.match(fakeDocument.body.children[0].textContent, /失败 1 张/);
}

function testXiaohongshuContentScriptShowsOriginalAndFallbackToast() {
  let messageListener = null;
  const fakeDocument = fakeXiaohongshuDocument([]);
  const context = {
    console: {
      info() {},
      warn() {},
      error() {}
    },
    document: fakeDocument,
    location: {
      href: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener(listener) {
            messageListener = listener;
          }
        }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "xiaohongshu-content.js"), "utf8"),
    context
  );

  messageListener(
    {
      type: "momento:import-status",
      requested: 3,
      imported: 3,
      sourceSummary: {
        original: 2,
        fallback: 1,
        unknown: 0
      },
      failures: []
    },
    {},
    () => {}
  );

  assert.strictEqual(fakeDocument.body.children.length, 1);
  assert.match(fakeDocument.body.children[0].textContent, /已保存 3 张/);
  assert.match(fakeDocument.body.children[0].textContent, /原图 2 张/);
  assert.match(fakeDocument.body.children[0].textContent, /fallback 1 张/);
}

function testXiaohongshuContentScriptDoesNotOverrideNativeContextMenu() {
  const fakeDocument = fakeXiaohongshuDocument([
    slide("0", "https://sns-webpic-qc.xhscdn.com/image-1", false),
    slide("1", "https://sns-webpic-qc.xhscdn.com/image-2", false)
  ]);
  const context = {
    console,
    document: fakeDocument,
    location: {
      href: "https://www.xiaohongshu.com/explore/6657f16d0000000015011e56"
    },
    chrome: {
      runtime: {
        onMessage: { addListener() {} }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(rootDir, "xiaohongshu-content.js"), "utf8"),
    context
  );

  assert.strictEqual(fakeDocument.contextMenuListener, null);
  assert.strictEqual(fakeDocument.body.children.length, 0);
}

function toPlainJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function fakeXiaohongshuDocument(slides) {
  const doc = {
    body: {
      children: [],
      appendChild(element) {
        this.children.push(element);
      }
    },
    defaultView: {
      setTimeout() {
        return 1;
      }
    },
    documentElement: {
      clientWidth: 1200,
      clientHeight: 800
    },
    contextMenuListener: null,
    contextMenuOptions: null,
    addEventListener(type, listener, options) {
      if (type === "contextmenu") {
        this.contextMenuListener = listener;
        this.contextMenuOptions = options;
      }
    },
    createElement() {
      return {
        listeners: {},
        style: {},
        className: "",
        textContent: "",
        addEventListener(type, listener) {
          this.listeners[type] = listener;
        },
        remove() {
          const index = doc.body.children.indexOf(this);
          if (index >= 0) {
            doc.body.children.splice(index, 1);
          }
        }
      };
    },
    querySelector(selector) {
      return selector === "#momento-xiaohongshu-menu" ? this.body.children[0] || null : null;
    },
    querySelectorAll(selector) {
      return selector === ".note-slider .swiper-slide" ? slides : [];
    }
  };
  return doc;
}

function slide(index, imageUrl, isDuplicate) {
  return {
    classList: {
      contains(className) {
        return className === "swiper-slide-duplicate" && isDuplicate;
      }
    },
    getAttribute(name) {
      if (name === "data-swiper-slide-index" || name === "data-index") {
        return index;
      }
      return null;
    },
    querySelector(selector) {
      if (selector !== "img") {
        return null;
      }

      return {
        currentSrc: imageUrl,
        src: imageUrl
      };
    }
  };
}

async function run() {
  await testXiaohongshuMenuReturnsAllImages();
  await testXiaohongshuMenuUsesInitialStateImagesBeforeDomFallback();
  testXiaohongshuInitialStateExtractionPrefersDefaultImageUrl();
  testXiaohongshuInitialStateExtractionUsesWbDftFromSnakeCaseFeed();
  testXiaohongshuInitialStateExtractionRunsAsInjectedFunction();
  await testXiaohongshuMenuInjectsContentScriptWhenMessageFails();
  testContextMenusIncludeXiaohongshuNativePageMenu();
  await testRuntimeMessageImportsImageBatch();
  await testImageBatchRequestsFeedbackUntilFirstSuccess();
  await testXiaohongshuContextMenuReportsImportStatusToPage();
  await testXiaohongshuRetriesFallbackWhenOriginalImportFails();
  await testXiaohongshuKeepsOriginalFailuresWithoutFallbackRetry();
  await testXiaohongshuDoesNotRetryOriginalWhenPageImageMatches();
  await testXiaohongshuSliderExtractionDedupesDuplicateSlides();
  testXiaohongshuImageUrlSourceMarksDftAsOriginal();
  await testXiaohongshuKeepsDftPageImageUrlAsOriginal();
  await testXiaohongshuPreferPageImageKeepsDftUrlWithIndex();
  await testXiaohongshuContentScriptLogsExtractionErrors();
  testXiaohongshuContentScriptShowsImportStatusToast();
  testXiaohongshuContentScriptShowsOriginalAndFallbackToast();
  testXiaohongshuContentScriptDoesNotOverrideNativeContextMenu();
  console.log("All tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
