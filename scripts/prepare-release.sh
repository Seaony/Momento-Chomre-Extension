#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="Momento 浏览器扩展"
MANIFEST_FILE="manifest.json"
DIST_DIR="dist"

export GIT_PAGER=cat
export PAGER=cat

usage() {
  cat <<EOF
Usage:
  scripts/prepare-release.sh <version>

Example:
  scripts/prepare-release.sh 0.1.1

Environment:
  MOMENTO_CHROME_RELEASE_REPOSITORY  GitHub repository for the Release. Default: repository parsed from origin
  MOMENTO_CHROME_RELEASE_TAG         Release tag. Default: v<version>
  MOMENTO_CHROME_RELEASE_COMMIT      Release commit message. Default: chore: release <version>
EOF
}

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

step() {
  printf '\n==> %s\n' "$1"
}

default_repository() {
  local remote_url
  remote_url="$(git remote get-url origin 2>/dev/null || true)"

  case "$remote_url" in
    git@github.com:*.git)
      printf '%s\n' "${remote_url#git@github.com:}" | sed 's/\.git$//'
      ;;
    https://github.com/*.git)
      printf '%s\n' "${remote_url#https://github.com/}" | sed 's/\.git$//'
      ;;
    https://github.com/*)
      printf '%s\n' "${remote_url#https://github.com/}"
      ;;
    *)
      printf ''
      ;;
  esac
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 1 ]]; then
  usage
  exit 64
fi

VERSION="$1"
RELEASE_TAG="${MOMENTO_CHROME_RELEASE_TAG:-v$VERSION}"

[[ "$VERSION" =~ ^[0-9]+(\.[0-9]+){1,3}$ ]] || fail "version must look like 0.1.1"

cd "$(dirname "$0")/.."

GITHUB_REPOSITORY="${MOMENTO_CHROME_RELEASE_REPOSITORY:-$(default_repository)}"
[[ -n "$GITHUB_REPOSITORY" ]] || fail "could not determine GitHub repository; set MOMENTO_CHROME_RELEASE_REPOSITORY"

require_command git
require_command gh
require_command node
require_command zip
require_command unzip

step "Checking release target"
CURRENT_BRANCH="$(git branch --show-current)"
[[ -n "$CURRENT_BRANCH" ]] || fail "not on a branch"
git rev-parse --verify --quiet "$RELEASE_TAG" >/dev/null && fail "local tag already exists: $RELEASE_TAG"
git ls-remote --exit-code --tags origin "refs/tags/$RELEASE_TAG" >/dev/null 2>&1 && fail "remote tag already exists: $RELEASE_TAG"
gh auth status --active --hostname github.com >/dev/null
gh release view "$RELEASE_TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1 && fail "GitHub Release already exists: $RELEASE_TAG"

step "Checking working tree"
[[ -z "$(git status --porcelain=v1)" ]] || fail "working tree has pending changes; commit or stash them before release"

step "Updating manifest version"
node - "$VERSION" <<'NODE'
const fs = require("fs");

const version = process.argv[2];
const manifestPath = "manifest.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

manifest.version = version;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

MANIFEST_VERSION="$(node -e 'const fs = require("fs"); const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8")); process.stdout.write(manifest.version);')"
[[ "$MANIFEST_VERSION" == "$VERSION" ]] || fail "manifest version is $MANIFEST_VERSION, expected $VERSION"

step "Running validation"
node test/run-tests.js
node --check background.js
for script in src/*.js; do
  node --check "$script"
done
node --check test/run-tests.js
node -e 'const fs = require("fs"); JSON.parse(fs.readFileSync("manifest.json", "utf8"));'
git --no-pager diff --check

step "Packaging extension"
PACKAGE_PATH="$(scripts/package-extension.sh "$DIST_DIR")"
unzip -l "$PACKAGE_PATH" >/dev/null

MANUAL_PACKAGE_NAME="Momento-Image-Saver-Manual-Install-$VERSION"
MANUAL_WORK_DIR="$DIST_DIR/manual-install-root"
MANUAL_ROOT="$MANUAL_WORK_DIR/$MANUAL_PACKAGE_NAME"
MANUAL_ZIP="$DIST_DIR/$MANUAL_PACKAGE_NAME.zip"

rm -rf "$MANUAL_WORK_DIR"
rm -f "$MANUAL_ZIP"
mkdir -p "$MANUAL_ROOT/extension"
unzip -q "$PACKAGE_PATH" -d "$MANUAL_ROOT/extension"

cat > "$MANUAL_ROOT/README.md" <<EOF
# Momento 浏览器扩展手动安装说明

这个包用于在不提交 Chrome Web Store 审核的情况下，让用户手动安装 Momento Chrome 扩展。

## 安装步骤

1. 解压这个 zip。
2. 打开 Chrome，在地址栏输入 \`chrome://extensions/\`。
3. 打开右上角的 \`Developer mode\` / \`开发者模式\`。
4. 点击 \`Load unpacked\` / \`加载已解压的扩展程序\`。
5. 选择解压出来的 \`extension\` 文件夹。
6. 确认扩展列表中出现 \`Momento\`。
7. 启动本机 Momento。
8. 在网页图片上右键，选择 \`保存到 Momento\`（英文界面是 \`Save to Momento\`）。

## 其他保存方式

- 整帖保存：在小红书、Instagram、Pixiv、微博、X 等网站的帖子上右键，选择 \`保存这一帖全部\`。
- 批量保存：点工具栏上的扩展图标，在面板里挑选本页图片。
- 截图：在页面空白处右键，选择 \`截取可见区域保存到 Momento\`。

## 注意事项

- 不要直接选择整个 \`$MANUAL_PACKAGE_NAME\` 文件夹；Chrome 需要选择里面的 \`extension\` 文件夹。
- 不要直接把 zip 拖进 Chrome。普通 Chrome 用户通常需要先解压，再使用 \`Load unpacked\`。
- Momento 必须已经在本机运行，并在设置里打开「浏览器扩展」（监听 \`127.0.0.1:47641\`）。
- 这个安装方式不会自动更新。以后升级时，需要删除旧扩展，再按同样步骤加载新包。
- 如果 Chrome 提示开发者模式扩展警告，这是手动安装扩展的正常提示。
EOF

(
  cd "$MANUAL_WORK_DIR"
  zip -qr "../$MANUAL_PACKAGE_NAME.zip" "$MANUAL_PACKAGE_NAME"
)
rm -rf "$MANUAL_WORK_DIR"
unzip -l "$MANUAL_ZIP" >/dev/null

step "Committing release metadata"
if [[ -n "$(git status --porcelain=v1 -- "$MANIFEST_FILE")" ]]; then
  git add "$MANIFEST_FILE"
  git --no-pager diff --cached --check
  git commit -m "${MOMENTO_CHROME_RELEASE_COMMIT:-chore: release $VERSION}"
else
  printf 'Manifest already uses version %s; no release metadata commit needed.\n' "$VERSION"
fi

[[ -z "$(git status --porcelain=v1 --untracked-files=no)" ]] || fail "tracked changes remain after release commit"

step "Pushing branch and tag"
git tag "$RELEASE_TAG"
git push origin "$CURRENT_BRANCH"
git push origin "$RELEASE_TAG"

step "Creating GitHub Release"
gh release create "$RELEASE_TAG" "$PACKAGE_PATH" "$MANUAL_ZIP" \
  --repo "$GITHUB_REPOSITORY" \
  --title "$PROJECT_NAME $VERSION" \
  --generate-notes \
  --latest

cat <<EOF

Published release:
  Version:              $VERSION
  Tag:                  $RELEASE_TAG
  Repository:           $GITHUB_REPOSITORY
  Chrome Web Store ZIP: $PACKAGE_PATH
  Manual install ZIP:   $MANUAL_ZIP
  Release:              https://github.com/$GITHUB_REPOSITORY/releases/tag/$RELEASE_TAG
EOF
