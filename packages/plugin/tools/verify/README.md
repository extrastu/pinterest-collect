# tools/verify — pinterest-collect 合规验证（插件 v1.2）

> **验证口径（重要）**：本目录只走「安装清单 / Host HTTP API / 客户端产物静态检查」。
> 以下做法在 Harness 插件验证规范里明确禁止，**本目录不包含、也不执行**：
> 启动独立浏览器截图、搜索/重放鉴权 token、读取个人浏览器 profile、用 puppeteer/playwright
> 打开真实页面、模拟 React 或自建 renderer、mock 预览页。
>
> 唯一例外是 `tools/login-cdp-test.mjs`（另一个离屏工具，headless Chrome 自测登录 CDP 流程），
> 它不属于本目录，也不被 `check.mjs` 调用。

## 一条命令

```bash
cd /Users/extrastu/Deepseek/pinterest-collect/packages/plugin
node tools/verify/check.mjs
```

- 退出码：全部 PASS（或 SKIP）→ `0`；只要有一项 FAIL → `1`（可直接给 CI / 收尾脚本用）。
- 零依赖：只用 Node 22 内置模块（`fs`、`child_process`、`fetch`）。
- 一次运行目标 < 60s；单条 HTTP 都有超时（`AbortSignal.timeout`），默认时间预算 `--budget 60000`。
- 需要宿主在跑：`DSH_WEB_URL`（默认 `http://127.0.0.1:52011`）、`DSH_PROFILE_DIR`（默认 `~/.dsh/profiles/desktop`）、
  `DSH_HOME` / `PINTEREST_DATA_DIR`（定位 `pinterest-collect/session.json`，默认 `~/.dsh/pinterest-collect`）。
- 常用参数：
  ```bash
  node tools/verify/check.mjs --base http://127.0.0.1:52011
  node tools/verify/check.mjs --json tools/verify/check-report.json   # 生成机器可读报告
  node tools/verify/check.mjs --budget 60000
  ```

## 覆盖范围（15 项）

| 组 | 项 | 检查内容 |
|---|---|---|
| A 安装与清单 | A1 | profile `package.json` 的 `dsh.profile.bundles` 含 `pinterest-collect`；`node_modules/pinterest-collect` 是符号链接且 realpath 指向项目目录 |
| | A2 | `exports` 含 `.` / `./client` / `./locale/*.json` / `./icon` 且目标文件存在；`dsh.bundle.patch` 文件存在；`dsh.client.platform === "web"` |
| | A3 | `locale/en.json`、`locale/zh.json` 有 `meta.title` / `meta.description`；`icon.svg` 以 `<svg` 开头、含 `viewBox`、有闭合、< 256KiB |
| B Host 侧（真实 HTTP） | B4 | v1.1 已移除「推荐分类」：`GET /pinterest-api/topics` 必须 **404**（JSON error）；`GET /collection` 仍 200 且 boards/pins/activeBoardId 结构符合 CONTRACT |
| | B5 | 写一条临时收藏 → GET collection 可见 → `unsave` → **savedId 集合必须恢复到写入前**（恢复不了就 FAIL 并提示残留数据；B5 不允许省略） |
| | B6 | 未知路由 → 404 JSON；`POST /save` 垃圾 body / 错误形状 → 400 JSON；随后 `/health` 仍 200（服务不崩） |
| | B7 | `GET /health`：200、`version` 是 semver 字符串、`authReady` 是布尔、`account` 是对象；`GET /account`：200 且 `connected/valid/updatedAt/authReady/chromeAvailable/chromeName` 字段存在、类型正确 |
| | B8 | `GET /feed` 未登录：`authReady===false` → 503 且 `error` 是中文提示；`authReady===true` → 401。已真实登录（connected=true）时 SKIP，避免影响用户推荐流 |
| | B9 | `POST /account/login/start`：`chromeAvailable===false` → 409 + 中文 error；`chromeAvailable===true` → **SKIP**（调用会真的弹出 Chrome 登录窗口，脚本不启动浏览器）；非 SKIP 分支确认没有写 `session.json` |
| | B10 | `POST /account/cookies` 传垃圾串（只用 `_pinterest_sess=fake; _auth=0`）→ 400 或 503（取决于 `authReady`），**不得 500**；`POST /account/logout` → 200 且 `connected:false`；两个动作前后都不允许留下 `session.json` |
| C 客户端静态 | C11 | `node --check client.js` 通过；`client.js` 与 `src/client/parts/*.js` 同步（每个 part 已嵌入、顺序一致、无占位组件）；内嵌 `PC_CSS` 与 `src/client/panel.css` 一致（改了 CSS 没重建会 FAIL） |
| | C12 | `client.js` 只 `require('react')`；无 `document.body.appendChild/append/innerHTML`、无 `dangerouslySetInnerHTML`、无 `eval` / `new Function`（`document.head.appendChild(style)` 属规范允许的样式注入） |
| | C13 | `panel.css` 颜色合规。白名单：`#b32c48` / `#9c223d` / `#fff` / `#101014`、`rgba(...)`（阴影/蒙层）、引用主题 token 的 `color-mix(...)`；裸写其它 hex / `rgb(...)` / `hsl(...)` 语义色 → 违规 |
| | C14 | 注册 `slots.register({ name: 'main', key: 'pinterest-collect' })` 与 `sidebar.panellist`（`id` + label），main 用 `PcErrorBoundary` 兜底 |
| | C15 | v1.1 UI 静态：无 `/topics` 遗留（`PC_TOPIC_FALLBACK`、`/topics` 请求、topic chip 类名、`'推荐分类'` 字符串字面量）；`PcLoginDialog` 存在且被渲染；`panel.css` 有 `.pc-account-bar` / `.pc-login-card`；`client.js` 有 `pcFetch('/account')` 与 `/feed` 调用（直接字面量或等价的 `pathname` 形式都算） |

> **`pc-topic-row` 不是遗留**：这个 CSS 类仍被左侧收藏夹的 chips 行复用（`pc-topic-row pc-collection-chips`），
> C15 只拦截 topic chip 的遗留标识，不会误报它。

## 降级分支：`authReady`

CONTRACT 里 `authReady=false` 表示 Host 侧的登录/推荐模块还没加载（升级过程中）。脚本两种状态都兼容：

- `authReady=false`：B8 按 503、B10 的 cookies 按 503 验证，**结果仍是 PASS**，但会在运行摘要与 `--json`
  的 `degraded[]` 里明确写「按降级分支验证，登录模块就绪后需重跑」。
- `authReady=true`：B8 期望 401，cookies 期望 400。

查看当前是哪一种：

```bash
curl -s http://127.0.0.1:52011/pinterest-api/health
# {"ok":true,"version":"1.1.0","authReady":true,...}
```

另外 `chromeAvailable` 决定 B9：本机有 Chrome 时脚本**不会**调用 `/account/login/start`（那会真的弹窗），
而是标 SKIP；没有 Chrome 时才验证 409 降级提示。

## 数据安全

- **B5** 会写一条临时 Pin（标题含「临时验证 Pin」），**无论成功失败都会尝试 unsave**；结束后对比写入前后的
  savedId 集合，残留即 FAIL。测试 Pin 已在收藏里时直接 SKIP，不动用户数据。
- **B10** 只发送假的 cookie 串 `_pinterest_sess=fake; _auth=0`，**绝不写入任何真实 cookie / token**。
- `session.json` 只做 `stat`（大小 / 权限 / mtime）快照，**从不读取内容**（里面是登录 cookie）。
  脚本在运行前后各取一次快照，并检查测试窗口内：
  - 测前不存在 → 测后必须仍然不存在（不留下测试凭据）；
  - 测前已存在 → 报告里会写明，且 cookies / logout 这类会碰登录态的检查全部 SKIP，不覆盖、不删除用户登录态。
- `logout` 只会在「没有 session.json 且 connected=false」时执行，避免把用户真实账号踢下线。
- 失败时手动检查：
  ```bash
  curl -s http://127.0.0.1:52011/pinterest-api/collection   # 找 verify-check-*
  ls -la ~/.dsh/pinterest-collect/                            # 看 session.json 是否残留
  ```

## 不可验证项（仍然不可验证）

- **真实页面截图 / 真实 UI 交互**：Harness 页面 `/` 需要启动 token 鉴权；验证规范明确禁止另起浏览器、
  搜索/重放鉴权 token、用 puppeteer/playwright 打开真实页面，也不允许用 mock 预览页代替。因此
  `check.mjs` 不产出、也不伪造任何截图。
- **登录窗口里的人工登录流程**（账号密码 / 验证码 / 2FA / 第三方登录）与**推荐流的真实渲染结果**：
  `check.mjs` 本身不启动浏览器，无法验证「真的登录成功后的首页推荐长什么样」。
- 这两块另有**离屏路径**覆盖，但它们独立于本目录、不共享结果，`check.mjs` 不依赖它们也能跑：
  - `node tools/login-cdp-test.mjs` — headless Chrome 真跑 CDP：`findChrome()`、`startLogin()` 抓 cookie、
    未登录 `_auth=0`、超时/取消收尾、无残留 Chrome 进程（只用临时 profile，不碰日常浏览器）。
  - `node tools/host-api-test.mjs` — 最小 `ctx` 直接 `apply()`，离屏调 Host 路由，覆盖注册/收藏/错误处理/搜索/链接解析。
- 「真实收藏同步到 Pinterest 账号」也属于不可验证项：插件只做本地收藏夹 + 浏览/搜索，不会替用户向 Pinterest 写入。

## 输出示例

```
✔ [B7] GET /health（version semver / authReady 布尔 / account 对象）+ GET /account 字段类型
    GET /health → 200 {"ok":true,"version":"1.1.0",...,"authReady":true,...}
...
• [B9] 登录窗口入口：POST /account/login/start（无 Chrome→409+中文；有 Chrome→SKIP，绝不弹窗）
    POST /account/login/start → SKIP：本机检测到 Chrome，调用会真的弹出登录窗口；验证脚本不启动浏览器
...
结果: 15 项 → PASS 14 · FAIL 0 · SKIP 1 · 用时 906ms
运行时: version="1.1.0" authReady=true connected=false chromeAvailable=true chromeName="Google Chrome"

降级分支: 无（本次 authReady=true，账号/推荐接口走正常分支）

数据安全: session.json 测前=不存在 测后=不存在 → 安全（测试未写入/未删除）
```

表格里每项只给一行证据摘要；完整的命令/响应/行号在每个 `✔/✖/•` 块下面和 `--json` 报告里。
如果某项因为环境不可用而验证不了，会明确写 `SKIP` + 原因，不会编造 PASS。

## 维护注意

- **改了 `src/client/parts/*.js` 或 `src/client/panel.css` 后必须重跑 `node build-client.mjs`**，
  否则 C11 会 FAIL（构建产物不同步）。
- C15 对 `/feed` 调用的判定是「直接 `pcFetch('/feed…')`」**或**「`'/feed?limit=24'` 字面量经 `pcFetch(pathname)`
  发出」，两种都算；当前实现是后者。如果以后改成直接字面量，也无需改脚本。
- C13 的 `color-mix(...)` 允许直接引用 `var(--dsw-alias-*)`，也允许引用 panel.css 里**已定义为某个
  `var(--dsw-alias-*)` 的本地别名**（例如 `--pc-danger: var(--dsw-alias-state-error-primary)`）；
  没有主题 token 兜底的 `color-mix` 仍会 FAIL。
- 本目录只做只读验证；任何写操作都只发生在 B5 的临时收藏与 B10 的 logout（且受上面的数据安全约束）。
