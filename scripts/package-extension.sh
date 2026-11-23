#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-"$ROOT_DIR/dist"}"

cd "$ROOT_DIR"

VERSION="$(node -e 'const fs = require("fs"); const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8")); process.stdout.write(manifest.version);')"
PACKAGE_NAME="momento-image-saver-${VERSION}.zip"

node - <<'NODE'
const fs = require("fs");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const requiredFiles = [
  "manifest.json",
  "background.js",
  "options.html",
  "src/i18n.js",
  "src/options.js",
  "src/collect.js",
  "src/ui.js",
  "src/context.js",
  "src/post-button.js",
  "_locales/en/messages.json",
  "_locales/zh_CN/messages.json",
  "_locales/ja/messages.json",
  ...Object.values(manifest.icons || {})
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing package file: ${file}`);
  }
}
NODE

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

zip -qr "$OUTPUT_DIR/$PACKAGE_NAME" \
  manifest.json \
  background.js \
  options.html \
  src \
  _locales \
  icons

echo "$OUTPUT_DIR/$PACKAGE_NAME"
