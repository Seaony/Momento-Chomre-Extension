let lastContextImage = null;

document.addEventListener(
  "contextmenu",
  (event) => {
    lastContextImage = imageInfoAtPoint(event.clientX, event.clientY, event.target);
  },
  true
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "momento:get-context-image") {
    return false;
  }

  sendResponse(lastContextImage);
  return false;
});

function imageInfoAtPoint(x, y, target) {
  const url = findImageUrlAtPoint(x, y, target);
  if (!url || isUnsupportedImageUrl(url)) {
    return null;
  }

  return {
    url,
    pageUrl: location.href
  };
}

function findImageUrlAtPoint(x, y, target) {
  const directImageUrl = imageUrlFromElement(target);
  if (directImageUrl) {
    return directImageUrl;
  }

  const elements = document.elementsFromPoint(x, y);
  for (const element of elements) {
    const elementImageUrl = imageUrlFromElement(element);
    if (elementImageUrl) {
      return elementImageUrl;
    }

    const descendantImageUrl = imageUrlFromDescendant(element, x, y);
    if (descendantImageUrl) {
      return descendantImageUrl;
    }
  }

  return null;
}

function imageUrlFromElement(element) {
  if (!(element instanceof Element)) {
    return null;
  }

  if (element instanceof HTMLImageElement) {
    return element.currentSrc || element.src || null;
  }

  const backgroundImage = getComputedStyle(element).backgroundImage;
  const backgroundUrl = imageUrlFromBackground(backgroundImage);
  if (backgroundUrl) {
    return backgroundUrl;
  }

  return null;
}

function imageUrlFromDescendant(element, x, y) {
  const images = Array.from(element.querySelectorAll("img"));
  let bestImage = null;
  let bestArea = 0;

  for (const image of images) {
    const rect = image.getBoundingClientRect();
    if (
      x < rect.left ||
      x > rect.right ||
      y < rect.top ||
      y > rect.bottom ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      continue;
    }

    const area = rect.width * rect.height;
    if (area > bestArea) {
      bestImage = image;
      bestArea = area;
    }
  }

  return bestImage?.currentSrc || bestImage?.src || null;
}

function imageUrlFromBackground(backgroundImage) {
  if (!backgroundImage || backgroundImage === "none") {
    return null;
  }

  const match = backgroundImage.match(/^url\((['"]?)(.*?)\1\)$/);
  return match?.[2] || null;
}

function isUnsupportedImageUrl(url) {
  return url.startsWith("blob:") || url.startsWith("data:");
}
