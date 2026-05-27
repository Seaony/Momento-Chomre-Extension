# Momento Image Saver

Chrome Manifest V3 extension for saving web images into Momento.

## Install for local development

1. Start Momento and keep it running in the background.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose Load unpacked and select `/Users/seaony/code/Momento-Chrome`.

## Usage

Right-click an image in Chrome and choose **Save Image to Momento**.

On Instagram, the same action is available from the page context menu. The
extension records the image under the last right-click position because
Instagram often places non-image overlay elements above the actual `<img>`.

On Xiaohongshu note detail pages, right-click a blank area of the page and choose
**Save All Images to Momento** from Chrome's context menu to import every image
from the note slider. The extension uses Xiaohongshu's `url_default`/`WB_DFT`
image URLs from the page data or rendered slider and avoids synthesizing a
different CDN URL. After importing, the page shows a toast with the saved
original/fallback/failure counts.

The extension posts the image URL and source page URL to Momento's local import endpoint:

`http://127.0.0.1:47641/api/v1/import/image`

Momento downloads the image and imports it into the currently open library without opening a new tab or bringing Momento to the front.

## Current limits

- Momento must already be running.
- Only `http://` and `https://` image URLs are supported.
- Images that require Chrome-only cookies or page session state may fail to download in Momento.
- `blob:` and `data:` images are not supported by this lightweight bridge.

## Privacy

Momento Image Saver does not collect, sell, or upload user data to a third-party
server. When the user chooses a save action, the extension sends the selected
image URL and the source page URL to the local Momento app at
`http://127.0.0.1:47641/api/v1/import/image`. Momento downloads the image on
the user's Mac and imports it into the currently open local library.

The extension does not use analytics, ads, tracking cookies, or remote code. It
does not store browsing history or image history in Chrome storage.

## Chrome Web Store package

Run the packaging script from the repository root:

```sh
scripts/package-extension.sh
```

The script validates the manifest and icon paths, then writes a review-ready zip
to `dist/momento-image-saver-<version>.zip`. The package includes only the
extension runtime files and excludes tests, Git metadata, and release notes.

Chrome Web Store review materials are kept in `release/chrome-web-store/`.
