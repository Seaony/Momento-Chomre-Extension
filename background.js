const IMAGE_MENU_ID = "save-image-to-momento";
const INSTAGRAM_PAGE_MENU_ID = "save-instagram-image-to-momento";
const XIAOHONGSHU_NOTE_IMAGES_MENU_ID = "save-xiaohongshu-note-images-to-momento";
const MOMENTO_IMPORT_ENDPOINT = "http://127.0.0.1:47641/api/v1/import/image";
const XIAOHONGSHU_NOTE_URL_PATTERNS = [
  "https://xiaohongshu.com/explore/*",
  "https://www.xiaohongshu.com/explore/*"
];

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: IMAGE_MENU_ID,
      title: "Save Image to Momento",
      contexts: ["image"]
    });

    chrome.contextMenus.create({
      id: INSTAGRAM_PAGE_MENU_ID,
      title: "Save Image to Momento",
      contexts: ["page"],
      documentUrlPatterns: [
        "https://instagram.com/*",
        "https://www.instagram.com/*"
      ]
    });

    chrome.contextMenus.create({
      id: XIAOHONGSHU_NOTE_IMAGES_MENU_ID,
      title: "Save All Images to Momento",
      contexts: ["page", "image"],
      documentUrlPatterns: XIAOHONGSHU_NOTE_URL_PATTERNS
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.info("Momento context menu clicked", {
    menuItemId: info.menuItemId,
    pageUrl: info.pageUrl || tab?.url || null,
    tabId: tab?.id || null
  });

  const importRequests = await importRequestsForMenuClick(info, tab);
  console.info("Momento import requests prepared", {
    menuItemId: info.menuItemId,
    count: importRequests.length,
    firstImageUrl: importRequests[0]?.url || null
  });

  if (importRequests.length === 0) {
    return;
  }

  const feedbackState = {
    shouldControlFeedback: importRequests.length > 1,
    didRequestFeedback: false
  };
  let status = await importImages(importRequests, { feedbackState });
  if (info.menuItemId === XIAOHONGSHU_NOTE_IMAGES_MENU_ID) {
    status = await retryFailedXiaohongshuImportsWithFallback(info, tab, importRequests, status, feedbackState);
  }
  await reportImportStatusToTab(tab?.id, status);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "momento:import-images") {
    return false;
  }

  const importRequests = importRequestsFromMessage(message);
  importImages(importRequests).then((status) => {
    sendResponse({ imported: status.imported });
  });
  return true;
});

async function importImage(importRequest) {
  try {
    const body = {
      url: importRequest.url,
      pageUrl: importRequest.pageUrl
    };
    if (importRequest.playFeedback === false) {
      body.playFeedback = false;
    }

    const response = await fetch(MOMENTO_IMPORT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      const error = `HTTP ${response.status} ${response.statusText}${errorBody ? `: ${errorBody}` : ""}`;
      console.warn("Momento import failed", {
        url: importRequest.url,
        error
      });
      return {
        ok: false,
        error
      };
    }

    return { ok: true };
  } catch (error) {
    console.warn("Momento is not reachable. Keep Momento open in the background before saving images.", error);
    return {
      ok: false,
      error: error?.message || String(error)
    };
  }
}

async function importImages(importRequests, options = {}) {
  let imported = 0;
  const failures = [];
  const feedbackState = options.feedbackState || {
    shouldControlFeedback: importRequests.length > 1,
    didRequestFeedback: false
  };
  const sourceSummary = {
    original: 0,
    fallback: 0,
    unknown: 0
  };

  for (const importRequest of importRequests) {
    const result = await importImage(
      feedbackState.shouldControlFeedback && feedbackState.didRequestFeedback
        ? { ...importRequest, playFeedback: false }
        : importRequest
    );
    if (result.ok) {
      imported += 1;
      if (feedbackState.shouldControlFeedback) {
        feedbackState.didRequestFeedback = true;
      }
      const source = importRequest.source || "unknown";
      if (sourceSummary[source] === undefined) {
        sourceSummary.unknown += 1;
      } else {
        sourceSummary[source] += 1;
      }
    } else {
      const failure = {
        url: importRequest.url,
        source: importRequest.source || "unknown",
        error: result.error
      };
      if (importRequest.index !== undefined) {
        failure.index = importRequest.index;
      }
      failures.push(failure);
    }
  }

  console.info("Momento image import batch finished", {
    requested: importRequests.length,
    imported,
    sourceSummary,
    failures
  });

  return {
    requested: importRequests.length,
    imported,
    sourceSummary,
    failures
  };
}

async function importRequestsForMenuClick(info, tab) {
  if (info.menuItemId === IMAGE_MENU_ID && info.srcUrl) {
    return [
      {
        url: info.srcUrl,
        pageUrl: info.pageUrl || tab?.url || null
      }
    ];
  }

  if (info.menuItemId === INSTAGRAM_PAGE_MENU_ID) {
    return importRequestsFromInstagramContext(info, tab);
  }

  if (info.menuItemId === XIAOHONGSHU_NOTE_IMAGES_MENU_ID) {
    return importRequestsFromXiaohongshuNote(info, tab);
  }

  return [];
}

async function importRequestsFromInstagramContext(info, tab) {
  if (!tab?.id) {
    return [];
  }

  const response = await sendMessageToTab(tab.id, {
    type: "momento:get-context-image"
  });

  if (!response?.url) {
    console.warn("Momento could not find an Instagram image at the context menu location.");
    return [];
  }

  return [
    {
      url: response.url,
      pageUrl: response.pageUrl || info.pageUrl || tab.url || null
    }
  ];
}

async function importRequestsFromXiaohongshuNote(info, tab) {
  if (!tab?.id) {
    console.warn("Momento Xiaohongshu import skipped because the tab id is missing.", {
      pageUrl: info.pageUrl || null
    });
    return [];
  }

  const initialStateImages = await extractXiaohongshuImagesFromTab(tab.id);
  if (initialStateImages.length > 0) {
    console.info("Momento extracted Xiaohongshu images from page initial state.", {
      count: initialStateImages.length,
      firstImageUrl: initialStateImages[0]
    });
    return initialStateImages.map((url, index) => ({
      url,
      pageUrl: info.pageUrl || tab.url || null,
      source: "original",
      index
    }));
  }

  return importRequestsFromXiaohongshuPageImages(info, tab, false);
}

async function importRequestsFromXiaohongshuPageImages(info, tab, preferPageImage) {
  let response = await sendMessageToTab(tab.id, {
    type: "momento:get-xiaohongshu-note-images",
    preferPageImage
  });
  if (!response) {
    console.warn("Momento could not reach the Xiaohongshu content script. Injecting it now.", {
      tabId: tab.id,
      pageUrl: info.pageUrl || tab.url || null
    });
    const injected = await injectXiaohongshuContentScript(tab.id);
    if (!injected) {
      return [];
    }

    response = await sendMessageToTab(tab.id, {
      type: "momento:get-xiaohongshu-note-images",
      preferPageImage
    });
    if (!response) {
      console.warn("Momento still could not reach the Xiaohongshu content script after injection.", {
        tabId: tab.id,
        pageUrl: info.pageUrl || tab.url || null
      });
      return [];
    }
  }

  if (response.error) {
    console.warn("Momento Xiaohongshu content script returned an error.", {
      error: response.error,
      tabId: tab.id,
      pageUrl: info.pageUrl || tab.url || null
    });
  }

  const images = Array.isArray(response?.images) ? response.images : [];
  const importRequests = images
    .filter((image) => image?.url)
    .map((image) => ({
      url: image.url,
      pageUrl: image.pageUrl || info.pageUrl || tab.url || null,
      source: image.source || "unknown",
      index: image.index
    }));

  if (importRequests.length === 0) {
    console.warn("Momento could not find Xiaohongshu note images on this page.");
  }

  return importRequests;
}

async function retryFailedXiaohongshuImportsWithFallback(info, tab, originalRequests, status, feedbackState) {
  const failedOriginalIndexes = new Set(
    status.failures
      .filter((failure) => failure.source === "original")
      .map((failure) => failure.index ?? originalRequests.find((request) => request.url === failure.url)?.index)
      .filter((index) => index !== undefined)
  );

  if (failedOriginalIndexes.size === 0) {
    return status;
  }

  const fallbackRequests = await importRequestsFromXiaohongshuPageImages(info, tab, true);
  const originalRequestsByIndex = new Map(
    originalRequests
      .filter((request) => request.index !== undefined)
      .map((request) => [request.index, request])
  );
  const retryRequests = fallbackRequests.filter((request) => {
    if (!failedOriginalIndexes.has(request.index)) {
      return false;
    }

    return originalRequestsByIndex.get(request.index)?.url !== request.url;
  });
  if (retryRequests.length === 0) {
    return status;
  }

  console.info("Momento retrying failed Xiaohongshu originals with fallback images.", {
    retryCount: retryRequests.length
  });

  const retryStatus = await importImages(retryRequests, { feedbackState });
  return mergeImportStatusesAfterFallbackRetry(status, retryStatus, retryRequests);
}

function mergeImportStatusesAfterFallbackRetry(originalStatus, retryStatus, retryRequests) {
  const retriedUrls = new Set(retryRequests.map((request) => request.url));
  const retriedIndexes = new Set(
    retryRequests
      .map((request) => request.index)
      .filter((index) => index !== undefined)
  );
  return {
    requested: originalStatus.requested,
    imported: originalStatus.imported + retryStatus.imported,
    sourceSummary: {
      original: originalStatus.sourceSummary.original + retryStatus.sourceSummary.original,
      fallback: originalStatus.sourceSummary.fallback + retryStatus.sourceSummary.fallback,
      unknown: originalStatus.sourceSummary.unknown + retryStatus.sourceSummary.unknown
    },
    failures: [
      ...originalStatus.failures.filter((failure) => {
        if (failure.source !== "original" || failure.index === undefined) {
          return true;
        }

        return !retriedIndexes.has(failure.index);
      }),
      ...retryStatus.failures.filter((failure) => retriedUrls.has(failure.url))
    ],
    retriedWithFallback: true
  };
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }

      resolve(response);
    });
  });
}

async function extractXiaohongshuImagesFromTab(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        world: "MAIN",
        func: extractXiaohongshuImagesFromInitialState
      },
      (results) => {
        if (chrome.runtime.lastError) {
          console.warn("Momento could not read Xiaohongshu page initial state.", chrome.runtime.lastError.message);
          resolve([]);
          return;
        }

        const urls = Array.isArray(results?.[0]?.result) ? results[0].result : [];
        resolve(urls.map(normalizeXiaohongshuImageUrl).filter(Boolean));
      }
    );
  });
}

function extractXiaohongshuImagesFromInitialState() {
  function normalizeImageUrl(url) {
    if (typeof url !== "string" || url.length === 0) {
      return null;
    }

    const absoluteUrl = url.startsWith("//") ? `https:${url}` : url;
    return /^http:\/\/[^/]*xhscdn\.com\//.test(absoluteUrl)
      ? absoluteUrl.replace(/^http:\/\//, "https://")
      : absoluteUrl;
  }

  function imageInfoScene(info) {
    return info?.imageScene || info?.image_scene || "";
  }

  function imageUrl(image) {
    const infoList = image?.infoList || image?.info_list || [];
    const defaultUrl = image?.urlDefault || image?.url_default;
    const wbDftUrl = infoList.find((info) => imageInfoScene(info) === "WB_DFT")?.url;
    const firstInfoUrl = infoList[0]?.url;
    return defaultUrl || wbDftUrl || firstInfoUrl || image?.url || image?.urlPre || image?.url_pre;
  }

  function noteImages(note) {
    return note?.imageList || note?.image_list || [];
  }

  function noteDetailImages(state) {
    const noteDetailMap = state?.note?.noteDetailMap;
    if (!noteDetailMap) {
      return [];
    }

    return Object.values(noteDetailMap).flatMap((item) => noteImages(item?.note || item?.note_card || item));
  }

  function feedImages(state) {
    const items = state?.data?.items;
    if (!Array.isArray(items)) {
      return [];
    }

    const currentNoteId = window.location?.pathname?.match(/\/explore\/([^/?#]+)/)?.[1] || null;
    return items
      .filter((item) => !currentNoteId || item?.id === currentNoteId || item?.note_card?.id === currentNoteId || item?.noteCard?.id === currentNoteId)
      .flatMap((item) => noteImages(item?.note_card || item?.noteCard || item?.note || item));
  }

  const state = window.__INITIAL_STATE__;
  const urls = [...noteDetailImages(state), ...feedImages(state)]
    .map(imageUrl)
    .map(normalizeImageUrl)
    .filter(Boolean);
  return [...new Set(urls)];
}

function normalizeXiaohongshuImageUrl(url) {
  if (typeof url !== "string" || url.length === 0) {
    return null;
  }

  const absoluteUrl = url.startsWith("//") ? `https:${url}` : url;
  return /^http:\/\/[^/]*xhscdn\.com\//.test(absoluteUrl)
    ? absoluteUrl.replace(/^http:\/\//, "https://")
    : absoluteUrl;
}

function injectXiaohongshuContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["xiaohongshu-content.js"]
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn("Momento could not inject the Xiaohongshu content script.", chrome.runtime.lastError.message);
          resolve(false);
          return;
        }

        resolve(true);
      }
    );
  });
}

async function reportImportStatusToTab(tabId, status) {
  if (!tabId) {
    return;
  }

  const reported = await sendImportStatusToTab(tabId, status);
  if (reported) {
    return;
  }

  const injected = await injectXiaohongshuContentScript(tabId);
  if (!injected) {
    return;
  }

  await sendImportStatusToTab(tabId, status);
}

function sendImportStatusToTab(tabId, status) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: "momento:import-status",
        ...status
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn("Momento could not report import status to the page.", chrome.runtime.lastError.message);
          resolve(false);
          return;
        }

        resolve(true);
      }
    );
  });
}

function importRequestsFromMessage(message) {
  const images = Array.isArray(message?.images) ? message.images : [];
  return images
    .filter((image) => image?.url)
    .map((image) => ({
      url: image.url,
      pageUrl: image.pageUrl || null,
      source: image.source || "unknown"
    }));
}
