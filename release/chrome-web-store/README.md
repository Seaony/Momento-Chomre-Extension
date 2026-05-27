# Momento Image Saver Chrome Web Store Review Kit

This folder contains the materials needed to prepare a Chrome Web Store
submission for Momento Image Saver.

## Files

- `submission-copy.md`: copy-ready store listing text, privacy practices,
  privacy policy draft, reviewer notes, screenshot checklist, and promotional
  image checklist.
- `release-checklist.md`: package contents, review risks, manual QA, release
  steps, rollback notes, and known limitations.

## Package

Generate the extension ZIP from the repository root:

```sh
scripts/package-extension.sh
```

The output is:

```text
dist/momento-image-saver-<manifest.version>.zip
```

Inspect the ZIP before uploading:

```sh
unzip -l dist/momento-image-saver-<manifest.version>.zip
```

The ZIP should include only:

- `manifest.json`
- `background.js`
- `instagram-content.js`
- `xiaohongshu-content.js`
- `icons/`

## Before Submission

Replace placeholders in `submission-copy.md`:

- `https://<your-domain>/momento-image-saver`
- `https://<your-domain>/momento-image-saver/support`
- `<support-email-or-support-url>`

Create required Chrome Web Store assets:

- At least one screenshot.
- Small promotional image, 440 x 280.
- Public privacy policy URL using the draft in `submission-copy.md`.

Reload and test the packaged extension before uploading.
