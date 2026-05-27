# Momento Image Saver Chrome Web Store 审核材料

这个目录保存 Momento Image Saver 提交 Chrome Web Store 审核时需要用到的材料。

## 文件

- `submission-copy.md`：可直接复制的商店详情文案、隐私实践说明、隐私政策草稿、审核员说明、截图清单和宣传图清单。
- `release-checklist.md`：打包内容、审核风险、手动 QA、发布步骤、回滚说明和已知限制。

## 打包

在仓库根目录生成扩展 zip：

```sh
scripts/package-extension.sh
```

输出文件是：

```text
dist/momento-image-saver-<manifest.version>.zip
```

上传前检查 zip 内容：

```sh
unzip -l dist/momento-image-saver-<manifest.version>.zip
```

zip 里应该只包含：

- `manifest.json`
- `background.js`
- `instagram-content.js`
- `xiaohongshu-content.js`
- `icons/`

## 提交前

先替换 `submission-copy.md` 里的占位符：

- `https://<your-domain>/momento-image-saver`
- `https://<your-domain>/momento-image-saver/support`
- `<support-email-or-support-url>`

准备 Chrome Web Store 必需素材：

- 至少一张截图。
- 440 x 280 的 small promotional image。
- 一个公开的隐私政策 URL，可以基于 `submission-copy.md` 里的隐私政策草稿创建。

上传前重新加载并测试打包后的扩展。
