# Momento Image Saver

Chrome Manifest V3 extension for saving web images into Momento.

## Install for local development

1. Start Momento and keep it running in the background.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose Load unpacked and select `/Users/seaony/code/Momento-Chrome`.

## Usage

Right-click an image in Chrome and choose **Save Image to Momento**.

The extension posts the image URL and source page URL to Momento's local import endpoint:

`http://127.0.0.1:47641/api/v1/import/image`

Momento downloads the image and imports it into the currently open library without opening a new tab or bringing Momento to the front.

## Current limits

- Momento must already be running.
- Only `http://` and `https://` image URLs are supported.
- Images that require Chrome-only cookies or page session state may fail to download in Momento.
- `blob:` and `data:` images are not supported by this lightweight bridge.
