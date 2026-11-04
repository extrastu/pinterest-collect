# 官网(静态站点)

Pinterest 收藏插件的官网。本目录是 monorepo 里的 `packages/website` 包:纯静态 HTML/CSS/JS,零构建、零外部依赖,中英双语,响应式,并针对 SEO 做了结构化数据、hreflang、Open Graph 与 sitemap。

## 目录

```
packages/website/
├─ index.html            中文首页(/)
├─ en/index.html         英文首页(/en/)
├─ 404.html              404 页面(带 noindex)
├─ assets/
│  ├─ styles.css         全站样式(浅色/深色主题变量 + 响应式布局)
│  ├─ app.js             主题切换 + 复制安装命令(无依赖)
│  ├─ icon.svg           插件图标(favicon / 品牌)
│  ├─ postsaver-icon.webp 相关 App 图标
│  └─ og-image.png       1200×630 社交分享图
├─ robots.txt
├─ sitemap.xml           含 hreflang 备用链接
└─ _headers              Cloudflare Pages / Netlify 响应头与缓存策略
```

## 本地预览

```bash
# 在仓库根目录,任选其一
python3 -m http.server 8080 --directory packages/website
npx serve packages/website
```

打开 http://localhost:8080 。英文页在 `/en/`。

## 部署

站点没有构建步骤,直接发布 `packages/website/` 目录即可:

| 平台 | 设置 |
|---|---|
| **Cloudflare Pages** | Root directory = 仓库根;Build command 留空;Build output directory = `packages/website` |
| **GitHub Pages** | Settings → Pages → Deploy from branch,目录选 `/packages/website`;或把内容推到 `gh-pages` |
| **Netlify / Vercel** | Publish directory = `packages/website`,无 build command |

`_headers` 会被 Cloudflare Pages / Netlify 自动识别;GitHub Pages 忽略它,功能不受影响。

## 生产地址

线上站点:**https://pinterestcollect.pages.dev/**(Cloudflare Pages,英文页 `/en/`)。

全站的正式域名与仓库地址已经写死在这两处:

| 值 | 用途 | 出现在 |
|---|---|---|
| `https://pinterestcollect.pages.dev` | 官网域名 | canonical、hreflang、OG/Twitter、JSON-LD、robots、sitemap |
| `https://github.com/extrastu/pinterest-collect` | 仓库地址 | 导航、Hero、footer、JSON-LD `sameAs` |

### 换成自定义域名(可选)

如果之后绑定自定义域名(例如 `pinterest.postsaver.app`),在仓库根目录执行:

```bash
grep -rl 'pinterestcollect.pages.dev' packages/website | xargs sed -i '' 's#https://pinterestcollect.pages.dev#https://your-domain.com#g'
```

然后检查:

```bash
grep -rn "pages.dev" packages/website --include='*.html' --include='*.xml' --include='*.txt' | grep -v README
```

App Store 推广链接里的 `ct=pinterest-collect-site` 是渠道参数,可在 App Store Connect 分析里区分官网来源;需要改推广位时改这个链接即可。

## SEO 清单(已内置)

- 每个页面唯一的 `<title>`(中文 / 英文各自本地化)与 `<meta name="description">`;
- `canonical`、`hreflang`(zh-CN / en / x-default)双向互指;
- Open Graph(Twitter `summary_large_image`)+ 1200×630 `og-image.png`;
- JSON-LD:`SoftwareApplication`、`WebSite`、`FAQPage`(与页面可见 FAQ 文本一致,避免结构化数据不一致);
- `robots.txt` + `sitemap.xml`(含 hreflang alternate);
- 语义化 HTML(单个 `<h1>`、`main`/`section`/`article`、`aria-labelledby`)、跳转链接、`alt` 文本;
- 响应式:移动端单列、导航折叠、`clamp()` 字号、`prefers-reduced-motion` 降级;
- 性能:无外部字体/脚本/图片请求(图标内联 SVG、分享图本地),单 CSS + 小 JS;
- CSS/JS 链接带 `?v=1.2.0` 版本号——因为 `_headers` 把 `/assets/*` 设成了 `immutable` 长缓存,改样式后请手动递增这个版本号;
- 安全/缓存:`_headers` 里设置 `nosniff`、`Referrer-Policy`、静态资源长缓存。

## 换成真实截图

现在首页的界面预览是**纯 CSS 画的示意图**(标注「界面示意」)。有真实截图后:

1. 把截图放进 `packages/website/assets/`(建议 2x 宽度、WebP/PNG);
2. 用 `<img>` 替换 `index.html`、`en/index.html` 里的 `.mock` 区块;
3. 给图片加 `alt`、`width`/`height` 与 `loading="lazy"`,避免布局抖动;
4. 更新 `og-image.png`(可用截图拼版)与 `og:image` 尺寸。

## 新增语言

复制 `en/` 为新语言目录,改 `<html lang>`、`hreflang`、`canonical`、OG locale,并在两个已有页面的头部补一条 `<link rel="alternate" hreflang="...">`,最后更新 `sitemap.xml`。
