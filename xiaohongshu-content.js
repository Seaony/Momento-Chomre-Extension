chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "momento:import-status") {
    logMomentoImportStatus(message);
    return false;
  }

  if (message?.type !== "momento:get-xiaohongshu-note-images") {
    return false;
  }

  xiaohongshuNoteImagesFromDocument(document, {
    preferPageImage: message.preferPageImage === true
  })
    .then((images) => {
      console.info("Momento Xiaohongshu image extraction", {
        count: images.length,
        pageUrl: location.href,
        firstImageUrl: images[0]?.url || null
      });
      sendResponse({ images });
    })
    .catch((error) => {
      console.error("Momento Xiaohongshu image extraction failed", {
        message: error?.message || String(error),
        stack: error?.stack || null,
        pageUrl: location.href
      });
      sendResponse({
        images: [],
        error: error?.message || String(error)
      });
    });

  return true;
});

function logMomentoImportStatus(status) {
  const details = {
    requested: status.requested,
    imported: status.imported,
    sourceSummary: status.sourceSummary || {
      original: 0,
      fallback: 0,
      unknown: 0
    },
    failures: status.failures || [],
    pageUrl: location.href
  };

  showMomentoToast(importStatusText(details), details.failures.length > 0);

  if (details.failures.length > 0) {
    console.warn("Momento Xiaohongshu import finished with failures", details);
    return;
  }

  console.info("Momento Xiaohongshu import finished", details);
}

async function xiaohongshuNoteImagesFromDocument(doc = document, options = {}) {
  const slideImages = await imageInfosFromSliderSlides(doc, options);
  return uniqueImageInfos(slideImages);
}

async function imageInfosFromSliderSlides(doc, options) {
  const slides = Array.from(doc.querySelectorAll(".note-slider .swiper-slide"));
  const images = await Promise.all(
    slides
      .filter((slide) => !slide.classList?.contains("swiper-slide-duplicate"))
      .map(async (slide, index) => ({
        index: slideIndex(slide, index),
        image: await imageInfoFromSlide(slide, options)
      }))
  );

  return images
    .filter((image) => isSupportedImageUrl(image.image?.url))
    .sort((left, right) => left.index - right.index)
    .map((image) => ({
      ...image.image,
      index: image.index
    }));
}

function slideIndex(slide, fallbackIndex) {
  const rawIndex = slide.getAttribute("data-swiper-slide-index") || slide.getAttribute("data-index");
  const parsedIndex = Number.parseInt(rawIndex, 10);
  return Number.isFinite(parsedIndex) ? parsedIndex : fallbackIndex;
}

async function imageInfoFromSlide(slide, options) {
  const image = slide.querySelector("img");
  return xiaohongshuReachableImageInfo(image?.currentSrc || image?.src || null, options);
}

async function xiaohongshuReachableImageInfo(url, options = {}) {
  const normalizedUrl = normalizeXiaohongshuImageUrl(url);
  return {
    url: normalizedUrl,
    source: xiaohongshuImageUrlSource(normalizedUrl)
  };
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

function xiaohongshuImageUrlSource(url) {
  return typeof url === "string" && url.includes("!nd_dft_") ? "original" : "fallback";
}

function uniqueImageInfos(imageInfos) {
  const seen = new Set();
  const images = [];

  for (const imageInfo of imageInfos) {
    if (seen.has(imageInfo.url)) {
      continue;
    }

    seen.add(imageInfo.url);
    images.push({
      url: imageInfo.url,
      pageUrl: location.href,
      source: imageInfo.source || "unknown",
      index: imageInfo.index
    });
  }

  return images;
}

function importStatusText(details) {
  if (details.imported === 0) {
    return `保存失败：失败 ${details.failures.length} 张`;
  }

  const parts = [`已保存 ${details.imported} 张`];
  if (details.sourceSummary.original > 0) {
    parts.push(`原图 ${details.sourceSummary.original} 张`);
  }
  if (details.sourceSummary.fallback > 0) {
    parts.push(`fallback ${details.sourceSummary.fallback} 张`);
  }
  if (details.failures.length > 0) {
    parts.push(`失败 ${details.failures.length} 张`);
  }

  return parts.join(" · ");
}

function showMomentoToast(text, isError) {
  if (!document?.body) {
    return;
  }

  document.querySelector("#momento-xiaohongshu-toast")?.remove();

  const toast = document.createElement("div");
  toast.id = "momento-xiaohongshu-toast";
  toast.textContent = text;
  Object.assign(toast.style, {
    position: "fixed",
    right: "24px",
    bottom: "24px",
    zIndex: "2147483647",
    maxWidth: "360px",
    padding: "12px 14px",
    borderRadius: "8px",
    background: isError ? "#991b1b" : "#111827",
    color: "#ffffff",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.24)",
    font: "13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    lineHeight: "1.4"
  });

  document.body.appendChild(toast);
  const timer = document.defaultView?.setTimeout || setTimeout;
  timer(() => toast.remove(), 5000);
}

function isSupportedImageUrl(url) {
  return typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));
}
