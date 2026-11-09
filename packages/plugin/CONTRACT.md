# Pinterest 收藏插件 — 内部契约(所有成员共同遵守)

插件包路径:monorepo 内的 `packages/plugin`(安装时指向该目录)
包名:`pinterest-collect`;UI 面板 id:`pinterest-collect`;HTTP 前缀:`/pinterest-api`

产品形态:安装在 DeepSeek Harness Web UI 里的面板。左侧 = 我的 Pinterest 收藏列表(本地持久化),
右侧 = 内嵌 Pinterest 浏览器(webview 感),在右侧点「收藏」后立即出现在左侧。

v1.1:去掉「推荐分类」chips。右侧未登录时只给登录引导 + 搜索;登录 Pinterest 后显示
个性化首页推荐流(/feed)。登录方式:Host 打开独立 Chrome 窗口由用户自己登录,CDP 捕获 cookie;
或用户手动粘贴 cookie。

> Pinterest 禁止 iframe 嵌入(`x-frame-options: SAMEORIGIN`),所以右侧"webview"是由 Host 端
> 抓取 Pinterest 并渲染的浏览面板(地址栏 + 搜索 + 瀑布流 + Pin 详情),不是 iframe。

## 目录与写入分工(互不重叠)

| 文件 | 负责人 |
|---|---|
| `index.js`(Host 插件:路由 + 存储) | Lead |
| `lib/pinterest.mjs`(Pinterest 抓取客户端)、`tools/host-fetch-test.mjs` | host-fetch |
| `src/client/parts/10-collection.js`(左侧收藏面板组件) | collection-ui |
| `src/client/parts/00-shared.js`、`20-browser.js`、`30-detail.js`、`90-app.js`、`src/client/panel.css`、`build-client.mjs`、`client.js` | Lead |
| `tools/verify/*`(截图/交互验证脚本) | verify |
| `package.json`、`cordis.patch.yml`、`icon.svg`、`locale/*.json` | Lead |

不要修改别人的文件。需要改动契约时先发消息给 Lead。

## Host HTTP API(Lead 负责实现,collection-ui 按此调用)

全部为同源 `fetch`(页面在 `http://127.0.0.1:52011`),返回 JSON;错误时 HTTP 4xx/5xx 且 body `{"error":"..."}`。

- `GET  /pinterest-api/health` → `{ ok, version, pinterest: { ready }, authReady, account }`
- `GET  /pinterest-api/account` → `{ connected, valid, updatedAt, endpoint, message, authReady, chromeAvailable, chromeName, viewer: null }`
- `GET  /pinterest-api/account/viewer` → `{ viewer: { username, name, avatar, pinCount, boardCount } | null }`(`?force=1` 跳过缓存;首次约 2s,之后 30 分钟缓存,不阻塞面板首屏)
- `GET  /pinterest-api/account/pins?bookmark=&limit=24` → `{ pins: Pin[], bookmark, username }`:当前登录用户自己在 Pinterest 上 pin 的图(个人主页「已创建」网格,`UserPinsResource`,需登录;未登录 401,模块未就绪 503)
- `POST /pinterest-api/account/login/start` → `{ jobId, state, message, chrome: { name } }`;无 Chrome 时 `409 { error, code: 'ENOCHROME' }`
  两段式:阶段 A 用**不带 `--remote-debugging-port`** 的干净 Chrome 让用户登录(否则 `navigator.webdriver=true`,Google 会拒绝登录);阶段 B 用同 profile 的 headless 实例只读 cookie。
- `POST /pinterest-api/account/login/continue` `{ jobId }` → `{ ok, state, message }`:用户点了「我已完成登录,继续」,提前结束阶段 A 并进入阶段 B。
- `GET  /pinterest-api/account/login/status?jobId=` → `{ state, message, done, account? }`;state ∈ starting|launching|waiting-login|reading-session|cookies-found|closing|probing|success|failed|timeout|closed
- `POST /pinterest-api/account/login/cancel` `{ jobId }` → `{ ok }`
- `POST /pinterest-api/account/cookies` `{ cookieString | cookies }` → `{ connected, valid, imported, account }`;不是登录态时 400
- `POST /pinterest-api/account/verify` → `{ valid, message, account }`
- `POST /pinterest-api/account/logout` → `{ connected: false, ok: true }`
- `GET  /pinterest-api/feed?bookmark=&limit=24` → `{ pins, bookmark, endpoint }`;未登录 401;模块未就绪 503
- `GET  /pinterest-api/collection` → `{ boards: Board[], pins: SavedPin[], activeBoardId }`
- `POST /pinterest-api/collection/boards` `{ title }` → `{ board: Board }`
- `POST /pinterest-api/collection/boards/rename` `{ id, title }` → `{ board: Board }`
- `POST /pinterest-api/collection/boards/remove` `{ id }` → `{ ok: true }`(其中的 Pin 归入默认收藏夹)
- `POST /pinterest-api/save` `{ pin: Pin, boardId?, note? }` → `{ saved: SavedPin, collection: Collection }`(重复收藏时带 note 会顺手更新备注)
- `POST /pinterest-api/collection/note` `{ savedId, note }` → `{ saved: SavedPin, collection: Collection }`(空串清除备注,最多 280 字符)
- `GET /pinterest-api/export` → `{ app, version, exportedAt, collection }`(JSON 下载,不含登录 Cookie)
- `POST /pinterest-api/unsave` `{ savedId }` → `{ ok: true, collection: Collection }`
- `GET  /pinterest-api/search?q=<q>&bookmark=<b>&limit=24` → `{ pins: Pin[], bookmark, query }`(登录后结果按画像排序,未登录也能用)
- `GET  /pinterest-api/related?id=<pinId>&title=&description=&limit=24` → `{ pins: Pin[], bookmark }`
  详情页「更多类似」:host 用 title(≥8 字)否则 description 做回退搜索,剔除自身;不支持翻页(bookmark 仅为兼容字段)。
- `GET  /pinterest-api/resolve?url=` → `{ kind: 'pin'|'board'|'profile'|'search'|'unknown', value }`

登录态:`<DSH_HOME>/pinterest-collect/session.json`(`{ cookies: [...], updatedAt }`,权限 0600,退出登录即删除)。
校验登录成功以 cookie `_auth === '1'` 且 `_pinterest_sess` 非空为准。

`Board`:`{ id, title, createdAt, isDefault }`

`Pin`(统一结构,Host 端归一化,Pinterest 原始字段绝不外泄):
```json
{
  "id": "e1_xxx 或数字字符串",
  "title": "短标题(可空字符串)",
  "description": "描述(可空)",
  "image": "https://i.pinimg.com/474x/...jpg",
  "imageLarge": "https://i.pinimg.com/736x/...jpg",
  "width": 474, "height": 592,
  "dominantColor": "#624322",
  "pinUrl": "https://www.pinterest.com/pin/<id>/",
  "sourceUrl": "https://原始来源(可空)",
  "siteName": "i.pinimg.com 或 Uploaded by user(可空)",
  "pinner": { "name": "", "username": "" },
  "board": { "name": "", "url": "" },
  "isVideo": false
}
```
`SavedPin` = `Pin` + `{ savedId, boardId, savedAt, note? }`(`note` 是用户写的「为什么收藏它」,可选)

`account` 里 `authReady=false` 表示 Host 侧的登录/推荐模块还没加载(升级过程中),客户端应显示「重启 Harness」提示而不是登录按钮。

## Client 端共享 helpers(Lead 在 `00-shared.js` 里定义,collection-ui 直接用)

模块被拼接到同一个 factory 作用域(纯 JS 片段,没有 import/export,不要写 `export`/`require`),
顶部已提供:

```js
const React = require('react');
const h = React.createElement;
const { useState, useEffect, useMemo, useRef, useCallback } = React;

async function pcFetch(path, body)          // GET 无 body / POST JSON;失败 throw Error(message)
function pcTimeAgo(iso)                      // "刚刚" / "3 分钟前" / "10月28日"
function pcIcon(name, size)                  // 返回 SVG React 元素
// name ∈ pin|heart|heartFilled|search|plus|close|trash|external|refresh|grid|folder|spinner|link|chevron|check|arrowLeft|more
function pcAspect(pin)                       // 返回 "w/h" 字符串,失败默认 "3/4"
```

CSS 类名前缀 `pc-`;颜色只能用主题 token(不要写死颜色):
`--dsw-alias-bg-base|bg-layer-1|bg-layer-2|bg-overlay|border-l1|border-l2|brand-primary|label-primary|label-secondary|state-error-primary|state-success-primary|state-warn-primary|state-idle-primary|--dsw-specific-sidebar-fill`。
圆角 8/10px,行高 1.5,字号 11/12/13/15px,间距 4/8/12/16px。Pinterest 品牌红只用于「收藏」主按钮的实心态。

### `CollectionPane`(collection-ui 的唯一交付)

```js
function CollectionPane(props) { /* ... */ }
```
props:
```js
{
  collection: { boards: Board[], pins: SavedPin[], activeBoardId },  // 可能为空对象
  loading: boolean,            // 首次加载
  error: string,               // 加载失败的展示文案
  query: string,               // 左侧收藏内搜索词(由 App 持有)
  onQueryChange(next),
  activeBoardId: string,       // "all" 或 boardId
  onSelectBoard(id),
  onSave(pin),                 // App 提供:新建 + 保存
  onUnsave(savedId),          // App 提供
  onCreateBoard(title),
  onRenameBoard(id, title),
  onRemoveBoard(id),
  onOpenPin(pin),             // App 打开详情弹层
  onRetry(),
  onToast(message)
}
```
要求:
1. 高度自适应父容器(`height:100%`,内部列表 `overflow:auto`);宽度由外部 grid 给定,不要写死 px 宽度。
2. 顶部 44px 工具条:标题「我的收藏」+ 数量徽标 + 新建收藏夹按钮。
3. 收藏夹行(横向可滚动 chips):「全部」+ 每个 board(含数量);每个 board 支持右键/更多菜单改名、删除(用 `pcIcon('more')` 触发一个小菜单,注意点击外部关闭)。
4. 收藏内搜索框(受控 `query`)。
5. 瀑布流/双列网格展示 `SavedPin`:图片 `aspect-ratio` 按 `pcAspect`、圆角、hover 出现「取消收藏」和「打开」按钮;图片加载失败显示占位色块。
6. 空状态:没有收藏时给出引导文案「在右侧浏览 Pinterest,点 ♥ 收藏,就会出现在这里」。
7. loading 用骨架块;error 用浅色提示 + 重试按钮。
8. 所有可点元素有 `aria-label`,键盘可达;按钮是 `<button type="button">`。
9. 禁止直接写 DOM、禁止自己写 `<style>` 标签、禁止 localStorage(状态由 App 持有);不新建全局单例。
10. 组件内 `useMemo` 过滤/排序:按 `savedAt` 倒序;board 过滤;搜索匹配 title/description/note。
11. `SavedPin.note` 存在时在卡片标题下方展示(最多 3 行,超出省略);没有备注时不占位。

## 验证口径

- Host API: `curl -s http://127.0.0.1:52011/pinterest-api/health`(无需鉴权)。
- Client UI: 页面 `/` 需要启动 token,由 verify 负责拿到截图;无法拿到时用 `tools/verify` 的预览壳说明。
- 每个成员交付时附上自己跑过的命令与输出摘要。
