const MENU_ID = "save-image-to-momento";
const MOMENTO_IMPORT_ENDPOINT = "http://127.0.0.1:47641/api/v1/import/image";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save Image to Momento",
    contexts: ["image"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.srcUrl) {
    return;
  }

  try {
    const response = await fetch(MOMENTO_IMPORT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: info.srcUrl,
        pageUrl: info.pageUrl || null
      })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.warn("Momento import failed", result.error || response.statusText);
    }
  } catch (error) {
    console.warn("Momento is not reachable. Keep Momento open in the background before saving images.", error);
  }
});
