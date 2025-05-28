// ==UserScript==
// @name         网页导出 EPUB
// @namespace    http://tampermonkey.net/
// @version      6.0
// @description  高质量 EPUB 导出，兼容 Kindle / Apple Books，清除“相关文章/推荐内容”等噪声块，自动去除短内容段落（更稳健）
// @match        *://*/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @require      https://unpkg.com/@mozilla/readability@0.4.4/Readability.js
// @grant        none
// @noframes
// ==/UserScript==

(function () {
    'use strict';
    if (window.top !== window.self) return;
    const exportBtn = document.createElement("button");
    exportBtn.textContent = "📖 导出 EPUB";
    Object.assign(exportBtn.style, {
        position: "fixed", bottom: "20px", right: "20px", zIndex: 9999,
        padding: "10px 14px", backgroundColor: "#007aff", color: "white",
        border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px"
    });
    document.body.appendChild(exportBtn);

    function removeNoiseFromArticle(htmlContent) {
        const dom = new DOMParser().parseFromString(htmlContent, "text/html");
        const document = dom;
        const keywords = ["related", "more in", "you might also like", "recommended", "continue reading", "advertisement", "sponsored", "comment", "bottom"];

        // 优化关键词匹配：只匹配 className/id，避免误删正文
        document.querySelectorAll("section, aside, div, footer, nav").forEach(el => {
            const attrText = (el.className + " " + el.id).toLowerCase();
            if (keywords.some(k => attrText.includes(k))) el.remove();
        });

        // 去除过短的段落，降低误删风险
        document.querySelectorAll("p, div").forEach(el => {
            const text = el.textContent?.trim() || "";
            if (text.length < 20 && el.querySelectorAll("img, video").length === 0) el.remove();
        });

        return document.body.innerHTML;
    }

    function generateTextCover(title, author) {
        return new Promise(resolve => {
            const canvas = document.createElement("canvas");
            canvas.width = 900;
            canvas.height = 1200;
            const ctx = canvas.getContext("2d");

            // 背景：米白
            ctx.fillStyle = "#fdfaf5";
            ctx.fillRect(0, 0, canvas.width, canvas.height);


            // 标题文字（上方）
            ctx.fillStyle = "#666";
            ctx.textAlign = "center";
            const titleFont = "bold 108px serif";
            ctx.font = titleFont;
            const titleLines = wrapText(ctx, title, 800, titleFont);
            titleLines.forEach((line, i) => {
                ctx.fillText(line, canvas.width / 2, 380 + i * 120);
            });

            // 作者文字
            ctx.font = "54px sans-serif";
            ctx.fillText(author, canvas.width / 2, 600 + titleLines.length * 120);

            canvas.toBlob(blob => resolve(blob), "image/jpeg");
        });
    }



    function wrapText(ctx, text, maxWidth, font) {
        ctx.font = font;
        const words = text.split('');
        const lines = [];
        let line = '';
        for (let word of words) {
            const test = line + word;
            if (ctx.measureText(test).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        lines.push(line);
        return lines;
    }

    function selfCloseTags(html) {
        return html
            // 确保 <img ...> 变为自闭合 <img ... />
            .replace(/<img([^>]*?)(?<!\/)>/gi, (match, attrs) => {
                if (attrs.trim().endsWith('/')) return match;
                return `<img${attrs.trim()} />`;
            });
    }


    function escapeHtmlEntities(str) {
        return str
            .replace(/&nbsp;/g, '&#160;')
            .replace(/&copy;/g, '&#169;')
            .replace(/&mdash;/g, '&#8212;')
            .replace(/&ndash;/g, '&#8211;')
            .replace(/&quot;/g, '&#34;')
            .replace(/&apos;/g, '&#39;')
            .replace(/&(?![a-zA-Z]+;|#\d+;)/g, '&amp;');
    }

    function sanitizeAttributes(html) {
        return html.replace(/<([a-z]+)([^>]*?)>/gi, (match, tag, attrs) => {
            const safeAttrs = attrs
                .replace(/(\w+)=([^\s"'>]+)/g, '$1="$2"')   // style=max-width:100% → style="max-width:100%"
                .replace(/“|”/g, '"')                       // 中文引号转英文
                .replace(/[\u200B-\u200D\uFEFF]/g, '')      // 去除零宽字符
                .replace(/\s+/g, ' ');                      // 多余空格合并
            return `<${tag}${safeAttrs}>`;
        });
    }

    function cleanContentDOM(contentDoc) {
        // 1. 删除 <picture> 和 <source> 标签（包含 srcset 的）
        contentDoc.querySelectorAll("picture, source").forEach(el => el.remove());

        // 2. 删除不相关的非正文内容标签（脚本、样式、广告等）
        contentDoc.querySelectorAll("script, style, iframe, video, noscript").forEach(el => el.remove());

        // 3. 删除空的段落或 div（没有文字或仅空格）
        contentDoc.querySelectorAll("p, div").forEach(el => {
            const text = el.textContent.trim();
            const hasMedia = el.querySelector("img, video, audio");
            if (!text && !hasMedia) el.remove();
        });

        // 4. 删除 class 含 'advert', 'recommend', 'sponsor' 的区块（可扩展）
        contentDoc.querySelectorAll("[class*='advert'], [class*='recommend'], [class*='sponsor']").forEach(el => el.remove());
    }


    exportBtn.onclick = async () => {
        const zip = new JSZip();
        const articleRaw = new Readability(document.cloneNode(true)).parse();
        const title = articleRaw.title || document.title;
        const author = articleRaw.byline || "Unknown";
        const lang = "zh-CN";
        const uid = `book-${Date.now()}`;

        const cleanedContent = removeNoiseFromArticle(articleRaw.content);
        const contentDoc = new DOMParser().parseFromString(cleanedContent, "text/html");
        cleanContentDOM(contentDoc);
        const imageFiles = [];
        const images = contentDoc.querySelectorAll("img");

        for (let i = 0; i < images.length; i++) {
            try {
                const res = await fetch(images[i].src, { mode: "cors" });
                const blob = await res.blob();
                if (!["image/jpeg", "image/png"].includes(blob.type)) continue;
                const ext = blob.type.split("/")[1];
                const filename = `image_${i}.${ext}`;
                const buffer = await blob.arrayBuffer();
                imageFiles.push({ filename, type: blob.type, buffer });

                // ✅ 创建新的 <img> 元素
                const newImg = document.createElement("img");
                newImg.setAttribute("src", `images/${filename}`);
                newImg.setAttribute("alt", "");
                newImg.setAttribute("style", "max-width: 100%; height: auto;");

                // ✅ 替换原来的 <img> 元素，彻底避免拼接错误
                images[i].replaceWith(newImg);
            } catch {
                images[i].remove();
            }
        }


        const coverBlob = await generateTextCover(title, author);
        const coverBuf = await coverBlob.arrayBuffer();
        zip.file("OEBPS/images/cover.jpg", coverBuf);
        const coverItem = `<item id="cover" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`;
        const coverMeta = `<meta name="cover" content="cover"/>`;

        const children = Array.from(contentDoc.body.children);
        const chapters = [];
        let current = [], currentTitle = title;
        const pushChapter = (title, nodes) => {
            const content = nodes.map(n => n.outerHTML).join("\n");
            chapters.push({ title, content });
        };
        for (let node of children) {
            if (/^H2$/.test(node.tagName)) {
                if (current.length) pushChapter(currentTitle, current);
                currentTitle = node.textContent.trim();
                current = [node];
            } else {
                current.push(node);
            }
        }
        if (current.length) pushChapter(currentTitle, current);

        const manifestItems = [], spineItems = [], tocEntries = [];
        for (let i = 0; i < chapters.length; i++) {
            const chap = chapters[i];
            const raw = selfCloseTags(chap.content);
            const cleaned = sanitizeAttributes(raw);
            const safeContent = escapeHtmlEntities(cleaned);
            const ccc = safeContent.replace(/imgsrc/gi, 'img src')
            console.log(ccc)
            const html = `<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head><title>${chap.title}</title></head>\n<body>\n<h2>${chap.title}</h2>\n${ccc}\n</body>\n</html>`;
            const name = `chapter_${i}.html`;
            zip.file(`OEBPS/${name}`, html.trim());
            manifestItems.push(`<item id="chap${i}" href="${name}" media-type="application/xhtml+xml"/>`);
            spineItems.push(`<itemref idref="chap${i}"/>`);
            tocEntries.push(`<navPoint id="navPoint-${i + 1}" playOrder="${i + 1}"><navLabel><text>${chap.title}</text></navLabel><content src="${name}"/></navPoint>`);
        }

        for (const img of imageFiles) {
            zip.file(`OEBPS/images/${img.filename}`, img.buffer);
            manifestItems.push(`<item id="${img.filename}" href="images/${img.filename}" media-type="${img.type}"/>`);
        }

        zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

        zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);

        zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="utf-8"?><package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:creator>${author}</dc:creator><dc:language>${lang}</dc:language><dc:identifier id="bookid">${uid}</dc:identifier>${coverMeta}</metadata><manifest>${coverItem}${manifestItems.join("\n")}<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx">${spineItems.join("\n")}</spine></package>`);

        zip.file("OEBPS/toc.ncx", `<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${uid}"/></head><docTitle><text>${title}</text></docTitle><navMap>${tocEntries.join("\n")}</navMap></ncx>`);

        zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" }).then(content => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(content);
            a.download = `${title}.epub`;
            a.click();
        });
    };
})();