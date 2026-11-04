# Pinterest 收藏 · DeepSeek Harness 插件

**左侧是你的 Pinterest 收藏夹,右侧是登录后为你生成的 Pinterest 推荐流。看到喜欢的图,点一下 ♥ 就进左侧收藏夹。**

<sub>v1.2.0 · DeepSeek Harness 插件 · macOS / Windows / Linux · [English](README.en.md)</sub>

---

## 这是什么

这是装在 DeepSeek Harness 里的一个面板插件:侧边栏多一个「Pinterest 收藏」图标,打开后是一个双栏工作区——

- **左栏**:你自己的收藏夹(保存在本机,可建多个画板、搜索、拖宽)。
- **右栏**:一个 Pinterest 浏览窗。登录 Pinterest 后直接显示**按你口味生成的首页推荐流**;也可以搜索、粘贴链接、看详情、点 ♥ 收藏。
- 点收藏 → 立刻出现在左栏;点开任意图 → 右栏整页详情 + 「更多类似」推荐,可以一直逛下去。

它不是一个独立网站,而是 Harness Web UI 的原生面板:跟随 Harness 的主题、语言、窗口布局。

## 功能

- **双栏工作区**:左收藏、右浏览;中间分隔条可拖拽(键盘 ← / → 也行),宽度会记住。
- **登录 Pinterest**:两段式 Chrome 登录(打开一个干净 Chrome 窗口让你自己登录,含 Google / 验证码 / 两步验证),或手动粘贴 Cookie 兜底。
- **个性化推荐流**:登录后读取你自己的 Pinterest 首页流,无限滚动,可换一批。
- **搜索 / 链接**:地址栏输入关键词,或直接粘贴 `pinterest.com` 的搜索、画板、个人主页链接。
- **详情页(不是弹窗)**:大图 + 描述 + 作者,下面接「更多类似」推荐;返回时保留原浏览位置。
- **收藏夹管理**:新建 / 改名 / 删除、按画板筛选、收藏内搜索、一键取消收藏。
- **账号页**:点击账号条上的头像 → 看你在 Pinterest 上 pin 的图(个人主页网格),可继续收藏或看详情。
- **设置页(双栏)**:左侧是设置项列表(账号 / 外观 / 语言 / 关于),右侧是当前项的详情;外观(跟随系统 / 浅色 / 深色)与语言(中文 / English)写回 Harness,全局生效并持久化。关于页下方还有「相关 App」推荐位(见文末)。
- **细节**:macOS 隐藏标题栏适配(红绿灯/侧栏把手让位)、全局中英双语、深色主题适配、可访问性(焦点、aria、键盘操作)。

## 为什么右侧不是 `<iframe src="pinterest.com">`

Pinterest 对站点响应 `X-Frame-Options: SAMEORIGIN`,浏览器会直接拒绝任何跨源 iframe。所以「浏览窗」由两部分组成:

- **Host 端**(Node):复刻 Pinterest Web 的公开读取路径(先取 `csrftoken` cookie,再调 `resource/*Resource/get`),把结果归一化成统一 `Pin`;登录后带你的 cookie 读取个性化首页流。
- **浏览器端**(React):渲染地址栏、瀑布流、详情页、账号页。

另外,Pinterest 的「详情推荐 / 用户 Pin 网格」也不是公开 REST API,插件用的是 Pinterest Web 自己用的 resource 接口(需要登录态)。**Pinterest 改接口时这里会失效**——代码里做了多候选端点 + 降级,但不保证长期稳定。

## 安装

### 环境

- DeepSeek Harness(桌面版或 Web 版),profile 支持安装 bundle;
- 一键登录需要本机有 **Chrome / Chromium / Edge / Brave**(macOS 已适配 v156);没有 Chrome 时可手动粘贴 Cookie;
- 开发/测试需要 Node.js ≥ 22。

### 安装步骤

在 Harness 会话里用 `plugin_manager` 安装本地目录(路径换成你的仓库绝对路径):

```text
plugin_manager {
  action: "install_bundle",
  target: "/absolute/path/to/pinterest-collect/packages/plugin"
}
```

然后:

1. **重启一次 Harness**(Host 半的 JS 在进程内只加载一次;插件管理里把它关掉再打开也可以);
2. **刷新页面**(⌘R / Ctrl+R);
3. 侧边栏出现「Pinterest 收藏」图标,点开即用。

> 本仓库是 monorepo:**插件包在 `packages/plugin`**,安装时请指向这一层;仓库根目录只是 workspace 聚合,不含插件入口。
> 本插件以本地目录方式安装,改动源码后:客户端改完刷新页面;Host 改完重启 Harness 或关→开插件。

## 使用

1. 点侧边栏的 **Pinterest 收藏** 图标。
2. 首次进入右侧是登录引导 → 点「登录 Pinterest」:
   - **一键登录**(推荐):弹出独立 Chrome 窗口 → 在里面登录(可以用 Google 登录)→ 登录完成后点面板里的「**我已完成登录,继续**」(或按 ⌘Q 退出那个窗口)→ 插件自动读取登录态。
   - **粘贴 Cookie**:在自己浏览器登录 pinterest.com,从 DevTools → Application → Cookies 复制 `_pinterest_sess` / `csrftoken` / `_auth`,拼成一行粘进来。
3. 登录成功后右侧变成你的推荐流;地址栏可搜索,右上角可刷新。
4. 鼠标移到任意 Pin → 点「收藏」;点开图片 → 详情页(下面有更多类似)。
5. 左侧管理收藏夹:`+` 新建(自带输入框)、`⋯` 改名/删除、搜索框只搜收藏。
6. 点账号条上的**头像**进入账号页;点齿轮进入**设置页**(外观 / 语言 / 账号)。

## 登录是怎么做的(以及为什么不用调试端口)

Pinterest 没有免登录的个性化推荐接口,所以推荐必须用你的登录态。插件不碰你的账号密码:

1. **阶段 A**:用**不带任何调试 / 自动化开关**的干净 Chrome 打开 Pinterest 登录页,你正常登录。新版 Chrome 只要带 `--remote-debugging-port`,`navigator.webdriver` 就会变成 `true`,Google 会因此判定「此浏览器或应用可能不安全」并拒绝登录——这是早期版本的真实问题,所以登录窗口刻意不带调试端口。
2. **阶段 B**:你点「继续」或 ⌘Q 退出窗口后,插件用同一个 profile 跑一个 headless 一次性实例,只把 Pinterest cookie 读出来,读完立刻关闭;这一阶段完全不碰 Google 页面。

安全边界:

- cookie 只写在本机 `~/.dsh/pinterest-collect/session.json`(权限 `600`);
- 一键登录使用独立 Chrome 配置目录(`chrome-profile`),**不会**读取或改动你日常浏览器的登录状态;
- 面板里随时可退出登录,只删除本机 cookie,不影响浏览器里的 Pinterest;
- 所有网络请求只发往 `pinterest.com` / `pinimg.com`,不上传任何第三方。

## 数据与隐私

| 数据 | 位置 | 说明 |
|---|---|---|
| 收藏夹 | `~/.dsh/pinterest-collect/collection.json` | 原子写入;可用 `DSH_HOME` 或插件 `config.dataDir` 改位置 |
| 登录态 | `~/.dsh/pinterest-collect/session.json` | 权限 `600`,退出登录即删除 |
| 登录窗口配置 | `~/.dsh/pinterest-collect/chrome-profile/` | 独立 Chrome 配置,可复用 |
| 收藏图片 | Pinterest CDN(`i.pinimg.com`) | 只做展示,不下载转存 |
| App 推荐位图标 | 内联在 `client.js` 里的 data URI | 不发起额外网络请求;点击才跳转 App Store |

插件**不会**读取你的 Pinterest 密码,也不会把收藏写回你的 Pinterest 账号(见「已知限制」)。

## 架构

```
┌──────────────────────── Host(index.js + lib/) ────────────────────────┐
│ /pinterest-api/*   同源 HTTP 桥:health / account / feed / search ...  │
│ 收藏夹持久化        collection.json(原子写入)                         │
│ Pinterest 抓取      lib/pinterest.mjs:cookie、CSRF、分页、推荐流、我的Pin│
│ 登录               lib/browser-login.mjs:Chrome CDP 两段式登录         │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ fetch(同源,无需额外鉴权)
┌───────────────────────────────┴───────────────────────────────────────┐
│ Client(client.js,React,slot 面板)                                     │
│ 左:CollectionPane  右:BrowsePane(推荐流/搜索)                        │
│ 覆盖层:Pin 详情页 · 我的账号页 · 设置页 · 登录弹层                     │
│ 主题 token 化样式 + 极简 i18n(pcT)                                    │
└───────────────────────────────────────────────────────────────────────┘
```

### 本包目录结构

| 路径 | 作用 |
|---|---|
| `index.js` | Host 插件:`/pinterest-api` 路由、收藏夹、登录任务、账号/推荐/账号页接口 |
| `lib/pinterest.mjs` | Pinterest 抓取客户端(cookie / CSRF / 分页 / 重试 / 归一化 / 推荐流 / 我的 Pin) |
| `lib/browser-login.mjs` | 零依赖 Chrome CDP 登录器(两段式) |
| `src/client/parts/00-shared.js` | React 句柄、`pcFetch`、图标、头像、格式化 |
| `src/client/parts/10-collection.js` | 左侧收藏面板 + 收藏夹命名弹层 |
| `src/client/parts/14-i18n.js` 等 | 极简 i18n 与中英词典 |
| `src/client/parts/20-browser.js` | 右侧浏览面板(推荐流 / 搜索 / 无限滚动 / 账号条) |
| `src/client/parts/23-account.js` | 账号页(我的 Pin 网格) |
| `src/client/parts/24-settings.js` | 设置页(账号 / 外观 / 语言) |
| `src/client/parts/25-login.js` | 登录弹层(一键 / 粘贴 Cookie / 退出) |
| `src/client/parts/30-detail.js` | Pin 详情页 + 更多类似 |
| `src/client/parts/90-app.js` | 状态、动作、双栏布局、Toast、slot 注册 |
| `src/client/panel.css` | 全部样式(仅主题 token + 少量品牌/中性色) |
| `client.js` | 由 `build-client.mjs` 拼装出的浏览器模块(勿手改) |
| `build-client.mjs` | 把 `src/client/parts/*.js` + `panel.css` 拼成 `client.js`,自带语法检查 |
| `CONTRACT.md` | 内部接口与 UI 契约(二次开发先读这个) |
| `tools/` | 测试与验证脚本 |
| `README.en.md` | 英文文档 |

> 官网是 monorepo 里的另一个包:[`../website/`](../website/)(部署与占位符替换见其 README)。

## 开发

> 下面的命令都在 `packages/plugin` 目录下执行;在仓库根目录也可以用 `pnpm build` / `pnpm test` / `pnpm check`。

```bash
# 重新生成 client.js(自带 node --check)
node build-client.mjs

# 单测 / 集成测试(见下)
node tools/host-api-test.mjs
node tools/host-fetch-test.mjs
node tools/login-cdp-test.mjs
node tools/login-two-phase-test.mjs
node tools/verify/check.mjs
```

约定(详见 `CONTRACT.md`):

- 客户端是**普通 JS 片段**,不用 JSX,组件用 `h(...)`;只允许 `require('react')`,不要 import Harness Client 包;
- 颜色只用 `--dsw-alias-*` 主题 token,品牌红/中性遮罩是唯一例外;
- 所有用户可见文案用 `pcT('中文原文', { 变量 })`,英文词典放在 `17/16/19-i18n-*.js`;
- 不静默写 DOM、不读其他插件的 DOM。

## 官网

monorepo 里的 [`../website/`](../website/) 是一个零构建静态站:中文首页 `/`、英文 `/en/`,响应式布局、深浅色主题、复制安装命令,并内置好 SEO(canonical / hreflang / Open Graph / `SoftwareApplication` + `WebSite` + `FAQPage` 结构化数据 / sitemap / robots)。

```bash
# 在仓库根目录执行
python3 -m http.server 8080 --directory packages/website
```

部署与占位符(域名、GitHub 地址)替换清单见 [`../website/README.md`](../website/README.md)。

## 测试

| 命令 | 覆盖 | 现状 |
|---|---|---|
| `node tools/host-api-test.mjs` | 用最小 ctx 离屏跑 Host 路由(含真实 Pinterest 搜索) | 27 通过 |
| `node tools/host-fetch-test.mjs` | 抓取客户端真实联网自测(分页/重试/错误映射) | 210 断言通过 |
| `node tools/login-cdp-test.mjs` | Chrome CDP 登录管道(headless,不弹窗) | 22 通过 |
| `node tools/login-two-phase-test.mjs` | 两段式登录:阶段 A 无调试端口 + 阶段 B 读 cookie + 无残留进程 | 16 通过 |
| `node tools/verify/check.mjs` | 安装/清单/接口/静态合规检查 | 15 项(已登录时凭据相关项按保护规则 SKIP) |

## 常见问题

**登录窗口里 Google 提示「此浏览器或应用可能不安全」?**
旧版本用带调试端口的 Chrome 登录会触发;v1.2 已改为两段式(登录窗口不带调试端口)。确认用的是最新代码并重启/刷新。

**登录后推荐流是空的 / 提示读不到?**
Pinterest 的 Web resource 接口会变,也可能临时风控。先在账号页/设置页点「重新校验」,或重新登录。若持续失败,在 issue 里贴 `/pinterest-api/account` 的返回和面板提示。

**面板一片空白?**
客户端有错误边界,正常会显示「面板出错了 + 重试」。若整块空白,先刷新页面;改过 Host 代码则重启 Harness。

**粘贴单条 Pin 链接没反应?**
单条 Pin 需要登录态才能读,Pinterest 不提供稳定的匿名详情接口;请改用关键词搜索。

**收藏会同步到我 Pinterest 账号吗?**
不会。收藏保存在本机;每张详情页有「在 Pinterest 打开」,可在原帖手动保存。账号级写入需要 Pinterest OAuth,属于后续工作。

## 已知限制

1. 不写回 Pinterest 账号(需要 OAuth / 写权限,未实现)。
2. 推荐流 / 我的 Pin / 更多类似都依赖 Pinterest 私有 Web resource,接口变化可能失效。
3. 「更多类似」是回退实现(用标题/描述再搜索并剔除自身),相关度不如官方 closeup。
4. 一键登录需要本机 Chrome;Windows/Linux 的浏览器探测未充分验证。
5. 单条 Pin 链接不支持直接打开;Pinterest 登录态过期后需重新登录。
6. 界面文案中文为原文 + 英文翻译,新增文案需同步词典(否则英文态回退中文)。

## 贡献

- 先读 `CONTRACT.md`(Host API / UI 契约 / 写入分工);
- 改完跑 `node build-client.mjs` 和上面的测试;
- 提交前确认没有把 `~/.dsh/pinterest-collect/` 下的个人数据(session / collection / chrome-profile)带进仓库;
- 新增 UI 文案请同时补 `src/client/parts/*-i18n-*.js` 词典;
- PR 描述里写清动机、验证方式、截图(如涉及视觉)。

## 相关 App

**Post Saver: Save Social Posts**(iPhone / iPad)—把 X、Threads、Instagram、YouTube、小红书、微博、Pinterest 等 **23 个平台**的帖子保存成干净的文字 / 图片 / 视频:[App Store 下载](https://apps.apple.com/cn/app/post-saver-save-social-posts/id6816399878?ct=pinterest-collect)。

插件「设置 → 关于」下方也放了同一个入口(带 `ct=pinterest-collect` 参数,方便统计来源);图标是内联资源,不产生额外请求。

## 免责声明

本项目是非官方第三方插件,与 Pinterest 无任何关联。它通过 Pinterest Web 自身的接口读取数据,可能受 Pinterest 服务条款约束;请仅用于个人学习与自用,并自行承担账号风控等风险。Pinterest 名称与商标归 Pinterest, Inc. 所有。

## 许可证

发布前请补充 `LICENSE` 文件(推荐 MIT)。在许可证确定前,本仓库默认保留所有权利。
