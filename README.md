# webpage2epub

# 📖 网页导出 EPUB（v4 Final）

一个用于将网页正文一键导出为高质量 EPUB 文件的 Tampermonkey 脚本，兼容 Kindle、Apple Books、Calibre 等主流电子书平台。支持封面生成、章节拆分、图片下载与格式清洗，适合保存新闻、专栏、博客内容为离线电子书。

---

## ✨ 功能特性

- ✅ 一键导出网页正文为 `.epub` 文件
- ✅ 自动提取正文内容（基于 mozilla/readability）
- ✅ 自动清洗广告、推荐、评论等干扰块
- ✅ 图片本地化处理，修复跨域加载与自闭合结构
- ✅ 按章节拆分（基于 `<h2>` 结构）
- ✅ 完全兼容 EPUB 2.0 标准，适配 Kindle / Apple Books
- ✅ 高度可定制（支持 CSS、段落优化、封面风格扩展）

---

## 🧩 安装方法

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 插件（支持 Chrome / Firefox / Edge）
2. 创建新脚本，粘贴 `epub-export.user.js` 内容
3. 访问任意网页，点击右下角按钮：`📖 导出 EPUB`

---

---

## 🛠 技术栈与依赖

- [`@mozilla/readability`](https://github.com/mozilla/readability)：提取网页正文内容
- [`JSZip`](https://stuk.github.io/jszip/)：打包 `.epub` 文件
- 原生 Canvas API：自动绘制封面
- 原生 DOM API：图像处理与 XHTML 清洗

---

## 🔒 兼容性说明

| 平台         | 支持 |
|--------------|------|
| Kindle       | ✅ 支持（MOBI 可用 Calibre 转换） |
| Apple Books  | ✅ 原生支持 EPUB 文件 |
| Calibre      | ✅ |
| 微信读书      | ⚠️ EPUB 支持但可能不兼容封面样式 |

---


## 📌 TODO（未来支持）

- [ ] 支持用户自定义封面模板
- [ ] 增加段落排版控制（中文首行缩进等）
- [ ] 保存为 MOBI 格式
- [ ] 导出整个网站多页内容为合集 EPUB

---

## 💬 使用建议

- **推荐用于新闻、专栏、博客、文献类文章导出**
- 页面必须有清晰结构（正文元素 + `<h2>` 等章节标题）
- 遇到复杂页面建议开启 Safari 阅读模式再导出，效果更佳

---

## 📜 License

MIT License
