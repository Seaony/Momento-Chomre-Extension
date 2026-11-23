# Chrome Web Store Release Checklist

This checklist is for publishing the Momento Chrome extension from this repository. Keep the release package scoped to the extension runtime files and prepare review notes that explain the narrow local-bridge behavior clearly.

## Production ZIP Contents

Package with the existing script from the repository root:

```sh
scripts/package-extension.sh
```

Expected output name: `dist/momento-image-saver-<manifest.version>.zip`.

Files that should be in the ZIP:

- `manifest.json`
- `background.js`
- `options.html`
- `src/i18n.js`
- `src/options.js`
- `src/collect.js`
- `src/ui.js`
- `src/context.js`
- `src/post-button.js`
- `_locales/en/messages.json`
- `_locales/zh_CN/messages.json`
- `_locales/ja/messages.json`
- `icons/icon-16.png`
- `icons/icon-32.png`
- `icons/icon-48.png`
- `icons/icon-128.png`

Files that should not be in the ZIP:

- `README.md`
- `test/run-tests.js`
- `scripts/package-extension.sh`
- `release/`
- `dist/` from previous builds
- `.git/`, `.github/`, editor files, `.DS_Store`, local notes, screenshots, and temporary files
- source assets that are not consumed by Chrome, such as `logo.icns`
- any secrets, API keys, private certificates, `.pem` files, or local config

Before upload, inspect the ZIP:

```sh
unzip -l dist/momento-image-saver-<version>.zip
```

The archive should contain only the production files above. Do not upload an unpacked folder or a ZIP that contains the repository directory as its top-level entry.

## Manifest Review Risks

Current manifest facts to verify before release:

- `manifest_version` is `3`.
- `name` is `Momento`.
- `description` says the extension imports images into Momento.
- `version` is bumped for every uploaded package.
- `minimum_chrome_version` is `88`.
- `background.service_worker` is `background.js`.
- `icons` points to packaged PNG files under `icons/`.
- `permissions` is limited to `activeTab`, `scripting`, `contextMenus`, and `storage`.
- `host_permissions` is limited to `http://127.0.0.1:47641/*` plus Instagram and Xiaohongshu (the same sites as the content scripts).
- `content_scripts` are limited to Instagram and Xiaohongshu (one script records the right-click target, one adds the in-post save button).
- `key` pins the extension ID to `bdholohelelbeepbpdapldbibidacaoo`, the only ID Momento's local API accepts.

Permission explanation risks:

- `contextMenus`: required to add the user-invoked right-click actions `Save to Momento`, `Save Entire Post to Momento` and `Save Images on This Page…`.
- `activeTab`: required for temporary access to the active page after the user right-clicks or clicks the toolbar button, so the extension can find the clicked image or video, or list the page's images.
- `scripting`: required to run the packaged page scripts that find media, show the save status, and open the batch-save panel, only after a user action.
- `storage`: stores only the interface language chosen on the extension's options page.
- `host_permissions` for `http://127.0.0.1:47641/*`: required to send selected media to the locally running Momento app. This is loopback-only and should not be described as a remote web service.
- Instagram and Xiaohongshu content scripts record only the element under the last right-click (both sites cover images with overlays) and add a save button to posts. Clicking that button does not grant `activeTab`, so the extension needs host access to these two sites to collect the post's media.

Review notes to prepare:

- Single purpose: save user-selected web images from Chrome into the local Momento desktop app.
- User action boundary: imports happen only after the user chooses the extension's context menu item, clicks the toolbar icon and saves from the panel, or clicks the save button the extension adds to an Instagram or Xiaohongshu post.
- Data sent by the extension: the selected image or video URL (or the file itself for `blob:`/`data:` media), the source page URL, a suggested Referer, and the post title when the site provides one, posted to `http://127.0.0.1:47641/api/v1/`.
- Data destination: local loopback Momento app on the same machine; the extension does not send data to a third-party server.
- Remote code: select `No remote code`; all executed scripts are packaged in the extension.
- Storage behavior: Chrome storage holds only the chosen interface language; no browsing, image or save history.

High-risk wording to avoid in the listing:

- Do not imply the extension can download every private or authenticated image. Momento may fail when the image requires Chrome-only cookies or page session state.
- Do not describe the local HTTP endpoint as cloud sync.
- Do not claim automatic background saving. Every save starts from a user click: the context menu, the toolbar panel, or the in-post save button.

## Chrome Web Store Required Materials

Prepare these before opening the Developer Dashboard:

- Extension ZIP: `dist/momento-image-saver-<version>.zip`.
- Extension icon: 128x128 PNG. Current packaged file: `icons/icon-128.png`.
- Small promotional image: 440x280 PNG or JPEG.
- Screenshots: at least 1, preferably up to 5, showing actual usage. Required sizes are 1280x800 or 640x400, square corners, no padding.
- Store listing text: short summary, detailed description, category, language, support/contact information, and any homepage/support URLs.
- Privacy tab: single purpose statement, permission justifications, remote-code declaration, data-use disclosure, and privacy policy URL if the listing/dashboard requires one for handled user data.
- Distribution tab: visibility, regions, pricing, and trusted tester settings if applicable.
- Test instructions: tell reviewers to run Momento locally, confirm the endpoint `127.0.0.1:47641`, and use a public `http`/`https` image page, Instagram post, and Xiaohongshu note detail page.

Recommended listing copy points:

- "Adds Chrome context menu actions for saving selected images into the local Momento desktop app."
- "Works with normal image right-clicks, Instagram image context recovery, and Xiaohongshu note image batches."
- "Requires Momento to be running locally. The extension sends image URLs only to the local Momento import endpoint."

Official references checked while preparing this checklist:

- Chrome Web Store image requirements: https://developer.chrome.com/docs/webstore/images/
- Chrome Web Store publish flow: https://developer.chrome.google.cn/docs/webstore/publish?hl=en
- Chrome extension permissions list: https://developer.chrome.com/docs/extensions/reference/permissions-list
- Permission warning guidelines: https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings
- Chrome Web Store privacy fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- Chrome Web Store troubleshooting and policy notes: https://developer.chrome.com/docs/webstore/troubleshooting/

## Manual QA Checklist

Run baseline validation before manual QA:

```sh
node test/run-tests.js
node --check background.js
for script in src/*.js; do node --check "$script"; done
node --check test/run-tests.js
node -e 'JSON.parse(require("fs").readFileSync("manifest.json", "utf8"))'
git diff --check
```

Load the unpacked extension from `/Users/seaony/code/Momento-Chrome`, then verify:

- Chrome installs the extension without manifest errors.
- The extension icon renders in `chrome://extensions` and the toolbar extension menu.
- Permission prompts match the expected narrow permissions; investigate any unexpected broad host warning.
- With Momento running, right-click a normal public image and choose `Save to Momento`; the largest available version appears in the current Momento library and the page shows a status toast.
- With Momento stopped, the toast says Momento can't be reached; no tabs open and nothing downloads.
- `data:` and `blob:` images are uploaded as files; `blob:` videos (segmented streams) show the "can't be saved yet" message.
- On Instagram, right-click over an image or overlay, choose `Save to Momento`, then `Save Entire Post to Momento` on a carousel and a Reel; logged in and logged out.
- On Instagram, click the save button left of the bookmark in the feed and on a post page; each saves only that post.
- On a Xiaohongshu note, click the save button under the date; switch notes and confirm the button follows.
- On a Xiaohongshu note, save one image, then the whole note; Live photos save the image and its video; video notes save the video; notes viewed earlier in the same tab are not included.
- On Pixiv and Weibo posts, save one image and the entire post (Weibo needs a logged-in session).
- On Behance, Dribbble, Zcool, Huaban, Pinterest and X, save one image and the entire post; check that originals are saved, not thumbnails.
- Click the toolbar button, filter by size and format, Shift-click to select a range, and save; Momento asks for a folder once and notifies once for the whole batch.
- Open DevTools for the service worker and page; verify there are no uncaught exceptions during each flow.
- Monitor network requests; the extension should only call `http://127.0.0.1:47641/api/v1/` (status, import, import/file and job status).
- Reload Chrome and verify context menus are recreated after startup.
- Install from the generated ZIP or a copy of the exact ZIP contents and repeat one normal image save plus one batch save.

## Release Steps

1. Confirm the worktree does not contain unrelated release-blocking changes.
2. Update `manifest.json` `version` only as part of an intentional release change.
3. Run the baseline validation commands listed above.
4. Package with `scripts/package-extension.sh`.
5. Inspect the ZIP contents with `unzip -l`.
6. Load the packaged contents locally and complete manual QA.
7. Open Chrome Developer Dashboard and upload the ZIP.
8. Fill Store Listing, Privacy, Distribution, and Test Instructions.
9. Prefer deferred publishing for the first submitted build so approval and live rollout are separate decisions.
10. Submit for review.
11. Watch reviewer emails and dashboard status until the item is approved, rejected, staged, or published.
12. After approval with deferred publishing, publish within the allowed staged window or expect the staged submission to revert to draft.

## Rollback / Cancel Review Notes

- If a bug is found before submission, discard the generated ZIP, fix the repository, bump version if needed, rebuild, and upload only the new ZIP.
- If a bug is found after submitting but before approval, use Chrome Web Store `Cancel review` and upload a corrected package.
- If deferred publishing is enabled and the package is approved but not yet live, do not publish it; upload a corrected higher-version package and submit again.
- If a bad version is already live, Chrome Web Store updates require a new package. Restore the last known good code, bump `manifest.json` to a newer version than the live build, rebuild, submit, and publish after approval.
- Do not force push, overwrite review artifacts, or reuse an old ZIP name for a different package.
- Keep the exact uploaded ZIP and its source commit/tag identifiable for audit and support.

## Known Limits / Review Notes

- Momento must already be running locally; the extension does not launch the desktop app.
- The local endpoint is plain HTTP because it is loopback-only: `127.0.0.1:47641`.
- Only `http://` and `https://` image URLs are supported.
- `blob:` and `data:` image URLs are intentionally unsupported.
- Images requiring Chrome-only cookies, session state, or private CDN authorization may fail when Momento downloads them.
- Instagram support depends on the current DOM under the user's last right-click point and may break if Instagram changes overlays or image structure.
- Xiaohongshu support depends on note detail page structure and `window.__INITIAL_STATE__`; DOM fallback is used when initial state extraction is unavailable.
- The extension creates a transient Xiaohongshu toast for batch status; it does not add tracking, analytics, ads, or notifications.
- The extension currently has no cloud backend and no account system.
