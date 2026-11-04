/**
 * Pinterest 抓取客户端（Host 侧，ESM / Node 22 / 全局 fetch / 零第三方依赖）
 *
 * 设计要点
 * - Cookie 引导：首次请求前 GET https://www.pinterest.com/search/pins/?q=<q>，
 *   从 Set-Cookie 收下 csrftoken / _pinterest_sess / _auth 等，之后所有 resource 请求
 *   携带完整 Cookie 与 X-CSRFToken。会话超过 SESSION_TTL_MS 会重新播种。
 * - 403 重建：cookie 失效或被反爬拦截时，清空 cookie 重新播种并重试一次；再失败抛错。
 * - 429 / 5xx：转成可读中文 Error，message 中带 HTTP status（429 / 5xx）。
 * - 超时：每个请求 AbortSignal.timeout(timeoutMs)，默认 12s；超时抛 ETIMEDOUT。
 * - 分页：search 的 bookmark 原样透传给 data.options.bookmarks=[bookmark]，
 *   取 resource_response.bookmark（字符串或数组）作为下一页书签。
 * - 并发去重：完全相同的进行中请求（同 query/bookmark/limit）合并为同一个 Promise，
 *   完成后即释放；不同参数互不影响。可选能力，见 runOnce()。
 * - related：Pinterest 没有稳定的公开 related 接口（RelatedPinResource 需要数字 id，
 *   搜索结果是 hashed id，PinResource 会 404），因此用 title 作为 query 回退搜索并剔除自身。
 *   若调用方只给 id，会尝试用「最近一次搜索结果里缓存的该 pin 标题」补全 query。
 * - 登录（新增）：importCookies / exportCookies / clearCookies 管理内部 cookie jar；
 *   feed() 带登录 cookie 读 Pinterest 首页推荐流（候选端点按顺序尝试，成功后端点和
 *   probe() 结果都缓存）；probe() 判断登录态是否真的有效（不抛错）；viewer() 尽力提取
 *   当前登录用户。没有登录 cookie 或端点返回 401/403 时统一抛 code='EAUTH'。
 *
 * 只依赖 Pinterest 搜索页 + BaseSearchResource + 首页流 resource 这些私有端点。
 */

const ORIGIN = 'https://www.pinterest.com';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DEFAULT_TIMEOUT_MS = 12000;
/** cookie 会话多久后主动重新播种（Pinterest 的 csrftoken 通常能活更久，30min 足够稳） */
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_LIMIT = 100;
/** pin 元数据缓存上限，供 related({id}) 无标题时回退使用 */
const META_CACHE_MAX = 800;
const SEARCH_RESOURCE = 'BaseSearchResource/get/';

/** probe() 结果缓存时长：UI 会反复轮询登录态，60s 内不重复打 Pinterest */
const PROBE_TTL_MS = 60 * 1000;
/** viewer() 结果缓存时长（用户名/头像极少变化） */
const VIEWER_TTL_MS = 30 * 60 * 1000;

/**
 * 首页推荐流候选端点，按顺序尝试；成功一次后缓存 resource 名，下次直接命中。
 * 前三个是历史端点（2026 年实测已 404），第四个 UserHomefeedResource 是当前
 * Pinterest Web 实际使用的资源（从站点 bundle 确认；未登录请求返回 401），
 * 保留旧端点是为了 Pinterest 回滚/灰度时仍能工作。
 */
const HOME_FEED_CANDIDATES = [
  {
    resource: 'BaseHomefeedResource/get/',
    handler: 'www/index.js',
    sourcePath: '/',
    options: { field_set_key: 'react_home_feed', is_react: true },
  },
  {
    resource: 'HomefeedResource/get/',
    handler: 'www/index.js',
    sourcePath: '/',
    options: { field_set_key: 'react_home_feed', is_react: true },
  },
  {
    resource: 'BaseFeedResource/get/',
    handler: 'www/index.js',
    sourcePath: '/',
    options: {},
  },
  {
    resource: 'UserHomefeedResource/get/',
    handler: 'www/index.js',
    sourcePath: '/',
    options: { field_set_key: 'hf_grid', in_nux: false, in_news_hub: false, static_feed: false },
  },
];

/** 所有可预期的失败都抛这个（message 为中文，带 status / code 便于 Host 映射） */
export class PinterestError extends Error {
  constructor(message, { status = 0, code = 'EPINTEREST', cause } = {}) {
    super(message);
    this.name = 'PinterestError';
    this.status = status;
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function toPositiveInt(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function collapseWhitespace(s) {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}

function firstString(...values) {
  for (const v of values) {
    if (isNonEmptyString(v)) return v;
  }
  return '';
}

function absoluteUrl(rawUrl) {
  const s = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return `${ORIGIN}${s}`;
  return '';
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeLimit(limit) {
  if (limit === undefined || limit === null) return 24;
  const n = typeof limit === 'number' ? limit : Number(limit);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new PinterestError('limit 必须是正整数', { code: 'EINVAL' });
  }
  if (n < 1) {
    throw new PinterestError(`limit 必须大于 0（收到 ${limit}）`, { code: 'EINVAL' });
  }
  return Math.min(n, MAX_LIMIT);
}

function readSetCookies(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === 'function') {
    try {
      const list = headers.getSetCookie();
      if (Array.isArray(list) && list.length) return list;
    } catch {
      /* fallthrough */
    }
  }
  const joined = headers.get?.('set-cookie');
  if (!joined) return [];
  // 兜底拆分：Expires 里也有逗号，但 cookie 值本身不含 ';'，按 ', name=' 模式切
  return joined.split(/,(?=\s*[^;=,\s]+=)/g);
}

function headerField(headers, name) {
  try {
    return headers?.get?.(name) || '';
  } catch {
    return '';
  }
}

function statusMessage(status, retryAfterSeconds) {
  if (status === 403) return 'Pinterest 拒绝了请求（HTTP 403），可能是反爬拦截或 Cookie 失效，请稍后重试';
  if (status === 429) {
    const wait = retryAfterSeconds ? `，建议等待约 ${retryAfterSeconds} 秒` : '';
    return `Pinterest 请求过于频繁（HTTP 429）${wait}，请稍后再试`;
  }
  if (status === 404) return 'Pinterest 资源不存在（HTTP 404）';
  if (status >= 500) return `Pinterest 服务暂时不可用（HTTP ${status}），请稍后重试`;
  if (status >= 400) return `Pinterest 返回异常状态（HTTP ${status}）`;
  return `Pinterest 请求失败（HTTP ${status}）`;
}

// ---------------------------------------------------------------------------
// 图片挑选：contract 要求 image 优先 474x，imageLarge 优先 736x / orig
// ---------------------------------------------------------------------------

const IMAGE_PREFERENCE = ['474x', '236x', '736x', 'orig', '170x', '150x', '75x'];

function pickImage(images, key) {
  if (!images || typeof images !== 'object') return null;
  const entry = images[key];
  if (!entry) return null;
  if (typeof entry === 'string') {
    return entry ? { url: entry, width: 0, height: 0 } : null;
  }
  if (typeof entry === 'object' && isNonEmptyString(entry.url)) {
    return {
      url: entry.url.trim(),
      width: toPositiveInt(entry.width),
      height: toPositiveInt(entry.height),
      dominantColor: isNonEmptyString(entry.dominant_color) ? entry.dominant_color.trim() : '',
    };
  }
  return null;
}

function pickFirstImage(images) {
  for (const key of IMAGE_PREFERENCE) {
    const hit = pickImage(images, key);
    if (hit) return hit;
  }
  if (images && typeof images === 'object') {
    for (const key of Object.keys(images)) {
      const hit = pickImage(images, key);
      if (hit) return hit;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// normalizePin：Pinterest 原始 pin → CONTRACT 里的统一 Pin（字段缺失给安全默认值）
// ---------------------------------------------------------------------------

export function normalizePin(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const images = source.images && typeof source.images === 'object' ? source.images : {};

  const id =
    typeof source.id === 'string' || typeof source.id === 'number'
      ? String(source.id).trim()
      : firstString(source.pin_id, source.entity_id).trim();

  const mainImage =
    pickImage(images, '474x') || pickImage(images, '236x') || pickImage(images, '736x') || pickImage(images, 'orig') || pickFirstImage(images);
  const largeImage = pickImage(images, '736x') || pickImage(images, 'orig') || mainImage;

  let width = mainImage?.width || 0;
  let height = mainImage?.height || 0;
  if ((!width || !height) && images) {
    for (const key of IMAGE_PREFERENCE) {
      const entry = pickImage(images, key);
      if (entry && entry.width && entry.height) {
        width = width || entry.width;
        height = height || entry.height;
        break;
      }
    }
  }

  const description = collapseWhitespace(
    firstString(source.description, source.closeup_description, source.auto_alt_text)
  );
  let title = collapseWhitespace(firstString(source.title, source.grid_title, source.alt_text));
  if (!title && description) title = description.slice(0, 80).trim();
  if (title.length > 200) title = title.slice(0, 200).trim();

  const sourceUrl =
    absoluteUrl(source.link) ||
    absoluteUrl(source.rich_summary?.url) ||
    absoluteUrl(source.rich_metadata?.url) ||
    absoluteUrl(source.origin_url) ||
    '';

  const domain = isNonEmptyString(source.domain) ? source.domain.trim() : '';
  const siteName = domain || hostOf(sourceUrl) || '';

  const pinnerSource = source.pinner && typeof source.pinner === 'object' ? source.pinner : {};
  const pinnerName = firstString(pinnerSource.full_name, pinnerSource.name, pinnerSource.username).trim();
  const pinnerUsername = isNonEmptyString(pinnerSource.username) ? pinnerSource.username.trim() : '';

  const boardSource = source.board && typeof source.board === 'object' ? source.board : {};
  const boardName = firstString(boardSource.name, boardSource.title).trim();
  const boardUrl = absoluteUrl(boardSource.url);

  const dominantColor = firstString(
    source.dominant_color,
    mainImage?.dominantColor,
    pickImage(images, '236x')?.dominantColor,
    pickImage(images, '474x')?.dominantColor
  ).trim();

  const isVideo = Boolean(
    source.is_video === true ||
      source.type === 'video' ||
      (source.videos && typeof source.videos === 'object' && Object.keys(source.videos).length > 0)
  );

  return {
    id,
    title,
    description,
    image: mainImage?.url || '',
    imageLarge: largeImage?.url || mainImage?.url || '',
    width,
    height,
    dominantColor,
    pinUrl: id ? `${ORIGIN}/pin/${encodeURIComponent(id)}/` : '',
    sourceUrl,
    siteName,
    pinner: { name: pinnerName, username: pinnerUsername },
    board: { name: boardName, url: boardUrl },
    isVideo,
  };
}

// ---------------------------------------------------------------------------
// URL 解析（resolveUrl 的纯函数部分，便于单测）
// ---------------------------------------------------------------------------

const NON_CONTENT_TOP_LEVEL = new Set([
  'today',
  'explore',
  'topics',
  'categories',
  'settings',
  'about',
  'login',
  'signup',
  'business',
  'newsroom',
  'careers',
  'help',
  '_saved',
  'search',
  'resource',
  'pin',
  'ideas',
]);

function parsePinterestUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return { kind: 'unknown', value: href };
  }
  // api.pinterest.com 是内部接口域名（如短链中转），不当作内容页解析
  if (!isPinterestHost(url.hostname) || url.hostname.toLowerCase().startsWith('api.')) {
    return { kind: 'unknown', value: href };
  }
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const segments = path.split('/').filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  if (segments.length === 0) return { kind: 'unknown', value: href };

  const head = segments[0].toLowerCase();

  if (head === 'pin') {
    const id = segments[1] || '';
    return id ? { kind: 'pin', value: id } : { kind: 'unknown', value: href };
  }

  if (head === 'search') {
    const q = url.searchParams.get('q') || url.searchParams.get('query') || '';
    return q.trim() ? { kind: 'search', value: q.trim() } : { kind: 'unknown', value: href };
  }

  if (head === 'ideas') {
    const topic = segments[1] || '';
    return topic ? { kind: 'search', value: topic.replace(/-/g, ' ').trim() } : { kind: 'unknown', value: href };
  }

  if (NON_CONTENT_TOP_LEVEL.has(head)) return { kind: 'unknown', value: href };

  // /<username>/<board>/           → board
  // /<username>/<board>/<section>/ → board
  // /<username>/                   → profile
  if (segments.length === 1) {
    return { kind: 'profile', value: `${ORIGIN}/${segments[0]}/` };
  }
  return { kind: 'board', value: `${ORIGIN}/${segments[0]}/${segments[1]}/` };
}

function isPinterestHost(host) {
  const h = (host || '').toLowerCase();
  return h === 'pinterest.com' || h.endsWith('.pinterest.com');
}

/** cookie 的 domain 是否属于 Pinterest（去掉前导点后判断） */
function isPinterestCookieDomain(domain) {
  const d = typeof domain === 'string' ? domain.trim().toLowerCase().replace(/^\./, '') : '';
  return d === 'pinterest.com' || d.endsWith('.pinterest.com');
}

/** 还原 JSON 字符串片段里的转义（\u002F、\"、\/ 等） */
function decodeJsonFragment(value) {
  if (typeof value !== 'string' || !value) return '';
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
    .replace(/\\\\/g, '\\');
}

/**
 * 从首页 HTML 里尽力提取当前登录用户（拿不到就返回 null，绝不抛错）。
 * 先找 `"viewer":{...}` 片段（登录态才会有），再退回「username 紧跟 full_name」的通用片段。
 * @returns {{ username: string, name: string, avatar: string } | null}
 */
function parseViewerFromHtml(html) {
  if (typeof html !== 'string' || !html) return null;
  const segments = [];
  const viewerMatch = /"viewer"\s*:\s*\{/.exec(html);
  if (viewerMatch) segments.push(html.slice(viewerMatch.index, viewerMatch.index + 1500));
  segments.push(html);

  for (const segment of segments) {
    const username = /"username"\s*:\s*"([A-Za-z0-9_][A-Za-z0-9_.-]{1,39})"/.exec(segment);
    if (!username) continue;
    const nameMatch =
      /"full_name"\s*:\s*"((?:[^"\\]|\\.){0,80})"/.exec(segment) ||
      /"name"\s*:\s*"((?:[^"\\]|\\.){0,80})"/.exec(segment);
    const avatarMatch =
      /"avatar_url"\s*:\s*"(https?:[^"\\]{0,500})"/.exec(segment) ||
      /"image_sig"\s*:\s*"(https?:[^"\\]{0,500})"/.exec(segment);
    return {
      username: username[1],
      name: nameMatch ? collapseWhitespace(decodeJsonFragment(nameMatch[1])) : '',
      avatar: avatarMatch ? decodeJsonFragment(avatarMatch[1]) : '',
    };
  }
  return null;
}

/**
 * 从首页流 resource_response 里安全取出原始 pin 列表并归一化。
 * 兼容 `data.results` / `data` 数组 / `{ data: { stories: [] } }` / `{ data: { items: [] } }`，
 * 以及 story 包装（`{ items: [pin...] }`、`{ pin: {...} }`、`{ type:'story', data:{...} }`）。
 * 用有深度上限的迭代展开，Pinterest 改字段名时不至于直接崩。
 * @returns {object[]} normalizePin 之后的 Pin 数组（按 id 去重）
 */
function extractFeedPins(response) {
  const data = response && typeof response === 'object' ? response.data : null;
  const roots = [];
  if (Array.isArray(data)) {
    roots.push(data);
  } else if (data && typeof data === 'object') {
    for (const key of ['results', 'items', 'stories', 'feed', 'pins']) {
      if (Array.isArray(data[key])) roots.push(data[key]);
    }
    // data 本身可能就是一个 pin / 包装对象
    roots.push([data]);
  }

  const MAX_DEPTH = 4;
  const stack = roots.map((value) => ({ value, depth: 0 }));
  const candidates = [];
  while (stack.length) {
    const { value, depth } = stack.pop();
    if (Array.isArray(value)) {
      if (depth < MAX_DEPTH) for (const item of value) stack.push({ value: item, depth: depth + 1 });
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    // 已经像一条 pin 的，直接收下（后面 normalizePin 还会再校验）
    if ((value.images && typeof value.images === 'object') || isNonEmptyString(value.image)) {
      candidates.push(value);
      continue;
    }
    if (depth >= MAX_DEPTH) continue;
    for (const key of ['pin', 'item', 'data', 'node']) {
      if (value[key] && typeof value[key] === 'object') stack.push({ value: value[key], depth: depth + 1 });
    }
    for (const key of ['items', 'results', 'stories', 'pins']) {
      if (Array.isArray(value[key])) stack.push({ value: value[key], depth: depth + 1 });
    }
  }

  const pins = [];
  const seen = new Set();
  for (const raw of candidates) {
    const pin = normalizePin(raw);
    if (!pin.id || !pin.image) continue; // 没有 id 或没有图（广告占位、纯文本 story）跳过
    if (seen.has(pin.id)) continue;
    seen.add(pin.id);
    pins.push(pin);
  }
  return pins;
}

// ---------------------------------------------------------------------------
// createPinterestClient
// ---------------------------------------------------------------------------

export function createPinterestClient({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const requestTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.round(timeoutMs) : DEFAULT_TIMEOUT_MS;

  /** @type {Map<string, { name: string, value: string, domain: string, path: string, secure: boolean, httpOnly: boolean, expires: number }>} */
  let cookieJar = new Map();
  let csrftoken = '';
  let bootedAt = 0;
  /** 首页流探测成功的端点（resource 名），下次优先尝试 */
  let feedEndpoint = '';
  /** probe() 结果缓存 */
  let probeCache = null;
  /** viewer() 结果缓存 */
  let viewerCache = null;
  /** cookie 引导的进行中 Promise（并发去重） */
  let bootPromise = null;
  /** 进行中的同类请求 Promise（同 key 合并） */
  const inflight = new Map();
  /** pin.id → { title, boardName }，用于 related({ id }) 无 title 时回退 */
  const pinMeta = new Map();

  function cookieHeader() {
    return [...cookieJar.values()].map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  }

  /** 有没有「登录态」cookie：_auth=1，或只有 _pinterest_sess（_auth 还没写入） */
  function hasLoginCookies() {
    const auth = cookieJar.get('_auth');
    if (auth) return auth.value === '1';
    const sess = cookieJar.get('_pinterest_sess');
    return Boolean(sess && sess.value);
  }

  function hasSessionCookie() {
    const sess = cookieJar.get('_pinterest_sess');
    return Boolean(sess && sess.value);
  }

  /**
   * 收下 Set-Cookie。
   * @param {Headers} headers
   * @param {{ protectLogin?: boolean }} [options] protectLogin=true 时不覆盖登录 cookie
   *   （匿名引导只在已登录时补 csrftoken，避免把登录会话换成匿名会话）
   */
  function absorbCookies(headers, { protectLogin = false } = {}) {
    for (const line of readSetCookies(headers)) {
      if (typeof line !== 'string') continue;
      const pair = line.split(';')[0];
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!name) continue;
      if (protectLogin && (name === '_auth' || name === '_pinterest_sess')) continue;
      const previous = cookieJar.get(name);
      cookieJar.set(name, {
        name,
        value,
        domain: previous?.domain || '.pinterest.com',
        path: previous?.path || '/',
        secure: previous?.secure ?? true,
        httpOnly: previous?.httpOnly ?? true,
        expires: previous?.expires ?? -1,
      });
      if (name === 'csrftoken' && value) csrftoken = value;
    }
  }

  function baseHeaders({ accept = 'application/json, text/javascript, */*, q=0.01', referer = '' } = {}) {
    const headers = {
      'User-Agent': UA,
      Accept: accept,
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (referer) headers.Referer = referer;
    return headers;
  }

  function rememberPinMeta(pin) {
    if (!pin?.id) return;
    pinMeta.set(pin.id, { title: pin.title || '', boardName: pin.board?.name || '' });
    while (pinMeta.size > META_CACHE_MAX) {
      const oldest = pinMeta.keys().next();
      if (oldest.done) break;
      pinMeta.delete(oldest.value);
    }
  }

  /** 统一的 fetch 包装：超时、网络错误、状态码 → 中文 PinterestError */
  async function request(url, init, label) {
    let res;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(requestTimeout) });
    } catch (err) {
      const name = err?.name || '';
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new PinterestError(`请求 Pinterest 超时（${requestTimeout}ms）：${label}`, { code: 'ETIMEDOUT', cause: err });
      }
      throw new PinterestError(`无法连接 Pinterest：${label}（${err?.message || err}）`, { code: 'ENETWORK', cause: err });
    }
    return res;
  }

  async function drain(res) {
    try {
      await res.text();
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new PinterestError(`读取 Pinterest 响应超时（${requestTimeout}ms）`, { code: 'ETIMEDOUT', cause: err });
      }
      // 丢弃 body 失败不影响主流程（cookie 已收下）
    }
  }

  async function readJson(res, label) {
    let text = '';
    try {
      text = await res.text();
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new PinterestError(`读取 Pinterest 响应超时（${requestTimeout}ms）：${label}`, { code: 'ETIMEDOUT', cause: err });
      }
      throw new PinterestError(`读取 Pinterest 响应失败：${label}（${err?.message || err}）`, { code: 'ENETWORK', cause: err });
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new PinterestError(`Pinterest 返回了非 JSON 响应（HTTP ${res.status}）：${label}`, {
        status: res.status,
        code: 'EBADJSON',
      });
    }
  }

  /** cookie 引导：GET 搜索页拿 csrftoken（并发调用只发一次） */
  async function bootstrap(query) {
    if (bootPromise) return bootPromise;
    const q = isNonEmptyString(query) ? query.trim() : 'home decor';
    const label = 'cookie 引导';
    const p = (async () => {
      const url = `${ORIGIN}/search/pins/?q=${encodeURIComponent(q)}`;
      const res = await request(
        url,
        {
          method: 'GET',
          redirect: 'follow',
          headers: {
            ...baseHeaders({ accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }),
            'Upgrade-Insecure-Requests': '1',
          },
        },
        label
      );
      absorbCookies(res.headers, { protectLogin: hasLoginCookies() });
      await drain(res);
      if (!res.ok) {
        throw new PinterestError(`获取 Pinterest Cookie 失败：${statusMessage(res.status, retryAfterOf(res))}`, {
          status: res.status,
          code: 'EBOOTSTRAP',
        });
      }
      if (!csrftoken) {
        throw new PinterestError('Pinterest 未返回 csrftoken Cookie，可能被反爬拦截，请稍后重试', {
          status: res.status,
          code: 'ENOCSRF',
        });
      }
      bootedAt = Date.now();
      return csrftoken;
    })();
    bootPromise = p;
    try {
      return await p;
    } finally {
      if (bootPromise === p) bootPromise = null;
    }
  }

  function retryAfterOf(res) {
    const raw = headerField(res.headers, 'retry-after');
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  async function ensureSession(query) {
    if (csrftoken && bootedAt && Date.now() - bootedAt < SESSION_TTL_MS) return;
    await bootstrap(query);
  }

  async function resetSession() {
    // 已登录时不丢弃登录 cookie（feed 依赖它），只把匿名 cookie / csrftoken 清掉重新引导
    if (hasLoginCookies()) {
      for (const name of [...cookieJar.keys()]) {
        if (name !== '_auth' && name !== '_pinterest_sess') cookieJar.delete(name);
      }
      csrftoken = '';
    } else {
      cookieJar = new Map();
      csrftoken = '';
    }
    bootedAt = 0;
  }

  // ---------- Cookie 导入 / 导出 / 清理（登录态） ----------

  /**
   * 把一条外部 cookie 规范成内部 jar 结构；无效或非 Pinterest 域返回 null。
   * 兼容 CDP Cookie（domain/expires）和浏览器扩展导出的 expirationDate。
   */
  function normalizeImportedCookie(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) return null;
    const value = raw.value === undefined || raw.value === null ? '' : String(raw.value);
    const domain = isNonEmptyString(raw.domain) ? raw.domain.trim() : '.pinterest.com';
    if (!isPinterestCookieDomain(domain)) return null;
    const pathValue = isNonEmptyString(raw.path) && raw.path.trim().startsWith('/') ? raw.path.trim() : '/';
    const rawExpires = raw.expires ?? raw.expirationDate;
    const expiresNumber = typeof rawExpires === 'number' ? rawExpires : Number(rawExpires);
    return {
      name,
      value,
      domain,
      path: pathValue,
      secure: raw.secure !== false,
      httpOnly: Boolean(raw.httpOnly ?? raw.http_only),
      expires: Number.isFinite(expiresNumber) && expiresNumber > 0 ? expiresNumber : -1,
    };
  }

  /**
   * 导入登录 Cookie，写入内部 jar（内存）。
   * - 数组：CDP `Network.getAllCookies` 的 cookie 对象（也接受浏览器扩展导出的对象）
   * - 字符串：DevTools 里复制的 `a=1; b=2` 形式
   * 只认 Pinterest 域（数组里非 Pinterest 的条目会被忽略）。
   * @param {object[] | string} input
   * @returns {number} 实际写入的条数
   */
  function importCookies(input) {
    const entries = [];
    if (Array.isArray(input)) {
      for (const raw of input) {
        const cookie = normalizeImportedCookie(raw);
        if (cookie) entries.push(cookie);
      }
    } else if (typeof input === 'string') {
      for (const part of input.split(';')) {
        const pair = part.trim();
        if (!pair) continue;
        const eq = pair.indexOf('=');
        if (eq <= 0) continue;
        const name = pair.slice(0, eq).trim();
        if (!name) continue;
        entries.push({
          name,
          value: pair.slice(eq + 1).trim(),
          domain: '.pinterest.com',
          path: '/',
          secure: true,
          httpOnly: true,
          expires: -1,
        });
      }
    } else if (input && typeof input === 'object') {
      const cookie = normalizeImportedCookie(input);
      if (cookie) entries.push(cookie);
    }

    for (const cookie of entries) {
      cookieJar.set(cookie.name, cookie);
      if (cookie.name === 'csrftoken' && cookie.value) csrftoken = cookie.value;
    }
    if (entries.length) {
      // 导入即视为有效会话：重置引导时间，避免立刻用匿名会话覆盖登录 cookie
      bootedAt = Date.now();
      feedEndpoint = '';
      probeCache = null;
      viewerCache = null;
    }
    return entries.length;
  }

  /** 导出内部 jar（注意：包含真实登录 Cookie，调用方必须妥善保存、不要打日志） */
  function exportCookies() {
    return [...cookieJar.values()].map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: Boolean(cookie.secure),
      httpOnly: Boolean(cookie.httpOnly),
      expires: Number.isFinite(cookie.expires) ? cookie.expires : -1,
    }));
  }

  /** 清空内部 cookie jar 与所有登录态缓存（之后请求会重新做匿名引导） */
  function clearCookies() {
    const count = cookieJar.size;
    cookieJar = new Map();
    csrftoken = '';
    bootedAt = 0;
    feedEndpoint = '';
    probeCache = null;
    viewerCache = null;
    return count;
  }

  function buildResourceUrl(resource, sourcePath, data) {
    return (
      `${ORIGIN}/resource/${resource}` +
      `?source_url=${encodeURIComponent(sourcePath)}` +
      `&rs=typed` +
      `&data=${encodeURIComponent(JSON.stringify(data))}`
    );
  }

  function resourceHeaders(sourcePath) {
    return {
      ...baseHeaders({ referer: `${ORIGIN}${sourcePath}` }),
      'X-Requested-With': 'XMLHttpRequest',
      'X-Pinterest-AppState': 'active',
      'X-CSRFToken': csrftoken,
      'X-Pinterest-PWS-Handler': 'www/search/pins.js',
      Cookie: cookieHeader(),
    };
  }

  /**
   * 调一次 BaseSearchResource。403 时重建 cookie 重试一次；429/5xx 直接映射成中文 Error。
   * @returns {Promise<any>} resource_response
   */
  async function requestSearchResource({ data, sourcePath, label }) {
    await ensureSession(data?.options?.query);
    const url = buildResourceUrl(SEARCH_RESOURCE, sourcePath, data);

    let res = await request(url, { method: 'GET', redirect: 'follow', headers: resourceHeaders(sourcePath) }, label);

    if (res.status === 403) {
      await drain(res);
      await resetSession();
      await bootstrap(data?.options?.query); // 重建一次
      res = await request(url, { method: 'GET', redirect: 'follow', headers: resourceHeaders(sourcePath) }, `${label}（重试）`);
    }

    if (!res.ok) {
      const retryAfter = retryAfterOf(res);
      await drain(res);
      throw new PinterestError(`${label}失败：${statusMessage(res.status, retryAfter)}`, {
        status: res.status,
        code: res.status === 429 ? 'ERATELIMIT' : res.status >= 500 ? 'EUPSTREAM' : 'EHTTP',
      });
    }

    const json = await readJson(res, label);
    const response = json?.resource_response;
    if (!response || typeof response !== 'object') {
      throw new PinterestError(`${label}失败：Pinterest 响应缺少 resource_response`, {
        status: res.status,
        code: 'EBADSHAPE',
      });
    }
    if (response.status !== 'success') {
      const detail = firstString(response.message, response.error?.message, response.error);
      throw new PinterestError(
        `${label}失败：Pinterest 返回 status=${String(response.status)}${detail ? `（${detail}）` : ''}`,
        { status: res.status, code: 'EAPI' }
      );
    }
    return response;
  }

  function normalizeBookmark(bookmark) {
    if (typeof bookmark === 'string') return bookmark.trim() || null;
    if (Array.isArray(bookmark)) {
      const first = bookmark.find((b) => typeof b === 'string' && b.trim());
      return first ? first.trim() : null;
    }
    return null;
  }

  /** 同 key 的进行中请求合并成一个 Promise，完成后释放 */
  function runOnce(key, task) {
    const existing = inflight.get(key);
    if (existing) return existing;
    const p = (async () => task())();
    inflight.set(key, p);
    p.then(
      () => {
        if (inflight.get(key) === p) inflight.delete(key);
      },
      () => {
        if (inflight.get(key) === p) inflight.delete(key);
      }
    );
    return p;
  }

  async function doSearch({ query, bookmark, limit }) {
    const options = { query, scope: 'pins', page_size: limit };
    if (bookmark) options.bookmarks = [bookmark];
    const data = { options, context: {} };
    const sourcePath = `/search/pins/?q=${encodeURIComponent(query)}`;
    const label = `搜索「${query}」`;

    const response = await requestSearchResource({ data, sourcePath, label });
    const rawResults = Array.isArray(response.data?.results) ? response.data.results : [];

    const pins = [];
    const seen = new Set();
    for (const raw of rawResults) {
      const pin = normalizePin(raw);
      if (!pin.id || !pin.image) continue; // 无 id 或无图（广告占位等）直接跳过
      if (seen.has(pin.id)) continue;
      seen.add(pin.id);
      pins.push(pin);
      rememberPinMeta(pin);
    }

    return {
      pins: pins.slice(0, limit),
      bookmark: normalizeBookmark(response.bookmark),
      query,
    };
  }

  /**
   * 搜索。
   * @param {{ query: string, bookmark?: string, limit?: number }} params
   * @returns {Promise<{ pins: object[], bookmark: string|null, query: string }>}
   */
  async function search({ query, bookmark, limit = 24 } = {}) {
    const q = typeof query === 'string' ? query.trim() : '';
    if (!q) throw new PinterestError('搜索词不能为空', { code: 'EINVAL' });
    const size = normalizeLimit(limit);
    const bm = typeof bookmark === 'string' && bookmark.trim() ? bookmark.trim() : null;
    const key = `search|${q}|${bm || ''}|${size}`;
    return runOnce(key, () => doSearch({ query: q, bookmark: bm, limit: size }));
  }

  /**
   * 相关推荐。没有稳定独立接口，用 title（或缓存里的 pin 标题）作为 query 回退搜索并剔除自身。
   * @param {{ id: string, title?: string, limit?: number }} params
   * @returns {Promise<{ pins: object[], bookmark: string|null }>}
   */
  async function related({ id, title, limit = 24 } = {}) {
    const pinId = typeof id === 'string' || typeof id === 'number' ? String(id).trim() : '';
    const size = normalizeLimit(limit);
    let query = typeof title === 'string' ? title.trim() : '';
    if (!query && pinId && pinMeta.has(pinId)) query = pinMeta.get(pinId).title || '';
    if (!query) {
      throw new PinterestError(
        '缺少 title：Pinterest 无稳定的 related 接口，需要标题（或该 pin 先出现在本客户端的搜索结果中）才能回退搜索',
        { code: 'EINVAL' }
      );
    }
    const key = `related|${pinId}|${query}|${size}`;
    return runOnce(key, async () => {
      const result = await doSearch({ query, bookmark: null, limit: size });
      return {
        pins: result.pins.filter((pin) => pin.id !== pinId),
        bookmark: result.bookmark,
      };
    });
  }

  /** 跟随 pin.it / api.pinterest.com 短链跳转，最多 hops 次；失败返回 null */
  async function followShortLink(href, hops = 5) {
    let current = href;
    for (let i = 0; i < hops; i += 1) {
      let res;
      try {
        res = await request(
          current,
          { method: 'GET', redirect: 'manual', headers: baseHeaders({ accept: 'text/html,*/*' }) },
          '短链跳转'
        );
      } catch {
        return null;
      }
      const location = headerField(res.headers, 'location');
      await drain(res);
      if (!location) {
        return res.ok ? current : null;
      }
      try {
        current = new URL(location, current).href;
      } catch {
        return null;
      }
      const host = (() => {
        try {
          return new URL(current).hostname.toLowerCase();
        } catch {
          return '';
        }
      })();
      const isContentHost = isPinterestHost(host) && !host.startsWith('api.');
      if (isContentHost) {
        const parsed = parsePinterestUrl(current);
        if (parsed.kind !== 'unknown') return current;
      }
      // 跳到本站以外（既不是 pinterest.com 也不是 pin.it）就停止跟随
      if (!isPinterestHost(host) && !host.endsWith('pin.it')) return null;
    }
    return null;
  }

  /**
   * 解析用户粘贴的链接。
   * @param {string} url
   * @returns {Promise<{ kind: 'pin'|'board'|'profile'|'search'|'unknown', value: string }>}
   *   pin → pin id；board/profile → 规范化的 pinterest.com URL；search → 搜索词；unknown → 原始输入
   */
  async function resolveUrl(url) {
    const original = typeof url === 'string' ? url.trim() : '';
    if (!original) return { kind: 'unknown', value: '' };

    let candidate = original;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate.replace(/^\/+/, '')}`;
    }
    let parsed;
    try {
      parsed = new URL(candidate);
    } catch {
      return { kind: 'unknown', value: original };
    }

    const host = parsed.hostname.toLowerCase();
    if (host === 'pin.it' || host.endsWith('.pin.it')) {
      // 短链：跟随跳转后再解析；解析不出就降级 unknown（调用方可直接展示原链接）
      if (typeof fetch !== 'function') return { kind: 'unknown', value: original };
      const finalUrl = await followShortLink(parsed.href);
      if (!finalUrl) return { kind: 'unknown', value: original };
      const fromShort = parsePinterestUrl(finalUrl);
      return fromShort.kind === 'unknown' ? { kind: 'unknown', value: original } : fromShort;
    }

    if (!isPinterestHost(host)) return { kind: 'unknown', value: original };
    return parsePinterestUrl(parsed.href);
  }

  /**
   * 健康检查：会尝试（必要时播种）cookie，因此 ready 反映的是「现在能不能真的抓」。
   * 不抛错，失败放进 error 字段。
   * @returns {Promise<{ ready: boolean, cookieAgeMs: number|null, error?: string }>}
   */
  async function health() {
    const age = bootedAt ? Date.now() - bootedAt : null;
    try {
      await ensureSession();
      return { ready: Boolean(csrftoken), cookieAgeMs: bootedAt ? Date.now() - bootedAt : age };
    } catch (err) {
      return {
        ready: false,
        cookieAgeMs: bootedAt ? Date.now() - bootedAt : null,
        error: err?.message || String(err),
      };
    }
  }

  // -------------------------------------------------------------------------
  // 登录态：个性化首页流（feed / probe / viewer）
  // -------------------------------------------------------------------------

  /**
   * 调一次任意 Pinterest resource，返回 HTTP 状态与 JSON（不做重试/映射）。
   * 网络错误、超时、非 JSON 由 `request` / `readJson` 抛 PinterestError，交给调用方决定是否换端点。
   */
  async function callResource({ resource, sourcePath, data, handler, label }) {
    const url = buildResourceUrl(resource, sourcePath, data);
    const headers = {
      ...baseHeaders({ referer: `${ORIGIN}${sourcePath}` }),
      'X-Requested-With': 'XMLHttpRequest',
      'X-Pinterest-AppState': 'active',
      'X-Pinterest-PWS-Handler': handler,
      ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
      Cookie: cookieHeader(),
    };
    const res = await request(url, { method: 'GET', redirect: 'follow', headers }, label);
    if (!res.ok) {
      const retryAfter = retryAfterOf(res);
      await drain(res);
      return { status: res.status, retryAfter, json: null };
    }
    const json = await readJson(res, label);
    return { status: res.status, retryAfter: 0, json };
  }

  /**
   * 首页个性化推荐流。没有登录 cookie → 直接 EAUTH（不发无谓请求）。
   * 候选端点按 HOME_FEED_CANDIDATES 顺序尝试，成功后缓存端点；全部失败回退
   * BaseSearchResource 空查询，再失败抛最后一个错误。
   * @param {{ bookmark?: string, limit?: number }} params
   * @returns {Promise<{ pins: object[], bookmark: string|null, endpoint: string }>}
   */
  async function doFeed({ bookmark, limit }) {
    if (!hasLoginCookies()) {
      throw new PinterestError('需要登录 Pinterest', { status: 401, code: 'EAUTH' });
    }

    const candidates = [];
    if (feedEndpoint) {
      const cached = HOME_FEED_CANDIDATES.find((candidate) => candidate.resource === feedEndpoint);
      if (cached) candidates.push(cached);
    }
    for (const candidate of HOME_FEED_CANDIDATES) {
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }

    let lastError = null;
    /** 是否有候选端点返回过 403（可能是登录失效，也可能只是反爬；全部失败时按 EAUTH 报） */
    let sawForbidden = false;

    /** 兜底：BaseSearchResource 空查询。成功返回结果，失败返回 null 并把错误记到 lastError。 */
    const trySearchFallback = async () => {
      const fallbackLabel = '首页推荐兜底（BaseSearchResource 空查询）';
      try {
        const response = await requestSearchResource({
          data: { options: { query: '', scope: 'pins', page_size: limit }, context: {} },
          sourcePath: '/search/pins/?q=',
          label: fallbackLabel,
        });
        const pins = extractFeedPins(response);
        if (pins.length) {
          feedEndpoint = SEARCH_RESOURCE;
          for (const pin of pins) rememberPinMeta(pin);
          return { pins: pins.slice(0, limit), bookmark: normalizeBookmark(response.bookmark), endpoint: SEARCH_RESOURCE };
        }
        lastError = new PinterestError(`${fallbackLabel}没有返回可用的 Pin`, { code: 'EEMPTY' });
      } catch (error) {
        lastError = error;
      }
      return null;
    };

    // 上次命中的是兜底端点时先走兜底，避免每次都先打若干个失效的首页流端点
    if (feedEndpoint === SEARCH_RESOURCE) {
      const cachedFallback = await trySearchFallback();
      if (cachedFallback) return cachedFallback;
    }
    for (const candidate of candidates) {
      const options = { ...candidate.options };
      if (bookmark) options.bookmarks = [bookmark];
      const data = { options, context: {} };
      const label = `首页推荐（${candidate.resource.replace('/get/', '')}）`;

      let got;
      try {
        got = await callResource({
          resource: candidate.resource,
          sourcePath: candidate.sourcePath,
          data,
          handler: candidate.handler,
          label,
        });
      } catch (error) {
        lastError = error;
        continue;
      }

      // 401 = 明确未登录，直接 EAUTH；403 可能是登录失效也可能是反爬：
      // 先换下一个候选端点（防止历史端点被 403 拦掉真实端点），全部失败时再按 EAUTH 报。
      if (got.status === 401) {
        throw new PinterestError(`需要登录 Pinterest（HTTP 401）`, { status: 401, code: 'EAUTH' });
      }
      if (got.status === 403) {
        sawForbidden = true;
        lastError = new PinterestError(`${label}失败：${statusMessage(403)}`, { status: 403, code: 'EAUTH' });
        continue;
      }
      // 429 直接映射，避免把限流误当成端点失效继续打
      if (got.status === 429) {
        throw new PinterestError(`首页推荐失败：${statusMessage(429, got.retryAfter)}`, { status: 429, code: 'ERATELIMIT' });
      }
      if (!got.json) {
        lastError = new PinterestError(`${label}失败：${statusMessage(got.status, got.retryAfter)}`, {
          status: got.status,
          code: got.status >= 500 ? 'EUPSTREAM' : 'EHTTP',
        });
        continue;
      }

      const response = got.json?.resource_response;
      if (!response || typeof response !== 'object') {
        lastError = new PinterestError(`${label}失败：Pinterest 响应缺少 resource_response`, {
          status: got.status,
          code: 'EBADSHAPE',
        });
        continue;
      }
      if (response.status !== 'success') {
        const detail = firstString(response.message, response.error?.message, response.error);
        lastError = new PinterestError(
          `${label}失败：Pinterest 返回 status=${String(response.status)}${detail ? `（${detail}）` : ''}`,
          { status: got.status, code: 'EAPI' }
        );
        continue;
      }

      const pins = extractFeedPins(response);
      if (!pins.length) {
        lastError = new PinterestError(`${label}没有返回可用的 Pin`, { status: got.status, code: 'EEMPTY' });
        continue;
      }
      feedEndpoint = candidate.resource;
      for (const pin of pins) rememberPinMeta(pin);
      return { pins: pins.slice(0, limit), bookmark: normalizeBookmark(response.bookmark), endpoint: candidate.resource };
    }

    // 兜底：BaseSearchResource 空查询（拿不到就报错）
    const fallback = await trySearchFallback();
    if (fallback) return fallback;

    if (sawForbidden) {
      throw new PinterestError('需要登录 Pinterest（Pinterest 返回 HTTP 403）', { status: 403, code: 'EAUTH' });
    }
    if (lastError instanceof PinterestError) throw lastError;
    throw new PinterestError(`首页推荐失败：${lastError?.message || '所有候选端点均不可用'}`, {
      code: 'EAPI',
      cause: lastError,
    });
  }

  /**
   * 个性化首页推荐流（需要登录 Cookie）。
   * @param {{ bookmark?: string, limit?: number }} params
   * @returns {Promise<{ pins: object[], bookmark: string|null, endpoint: string }>}
   */
  async function feed({ bookmark, limit = 24 } = {}) {
    const size = normalizeLimit(limit);
    const bm = typeof bookmark === 'string' && bookmark.trim() ? bookmark.trim() : null;
    const key = `feed|${bm || ''}|${size}`;
    return runOnce(key, () => doFeed({ bookmark: bm, limit: size }));
  }

  /**
   * 判断登录态是否**真的**可用：有登录 cookie 就试拉一次小首页流，成功即有效。
   * 60s 内复用缓存；绝不抛错。
   * @returns {Promise<{ loggedIn: boolean, endpoint?: string, pinCount?: number, message?: string }>}
   */
  async function probe() {
    if (probeCache && Date.now() - probeCache.at < PROBE_TTL_MS) return { ...probeCache.result };

    let result;
    if (!hasLoginCookies()) {
      result = {
        loggedIn: false,
        message: hasSessionCookie() ? 'Cookie 里缺少 _auth=1，可能不是登录态' : '未登录 Pinterest',
      };
    } else {
      try {
        const page = await feed({ limit: 6 });
        result = { loggedIn: true, endpoint: page.endpoint, pinCount: page.pins.length };
      } catch (error) {
        result = {
          loggedIn: false,
          message: error?.code === 'EAUTH' ? '需要登录 Pinterest（登录态已失效）' : error?.message || '登录态校验失败',
        };
      }
    }

    probeCache = { at: Date.now(), result };
    return { ...result };
  }

  /**
   * 尽力提取当前登录用户信息（首页 HTML 里的 viewer 字段）。
   * 拿不到返回 null；不抛错、不阻塞、不做额外引导。
   * @returns {Promise<{ username: string, name: string, avatar: string } | null>}
   */
  async function viewer() {
    if (!hasLoginCookies()) return null;
    if (viewerCache && Date.now() - viewerCache.at < VIEWER_TTL_MS) return viewerCache.value;

    let value = null;
    try {
      const res = await request(
        `${ORIGIN}/`,
        {
          method: 'GET',
          redirect: 'follow',
          headers: {
            ...baseHeaders({ accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }),
            'Upgrade-Insecure-Requests': '1',
            Cookie: cookieHeader(),
          },
        },
        '读取登录用户'
      );
      if (res.ok) {
        // 首页 HTML 可达 1MB+，只做一次正则提取，不保留 body
        value = parseViewerFromHtml(await res.text());
      } else {
        await drain(res);
      }
    } catch {
      value = null;
    }

    // 首页 HTML 里通常没有头像，再补一次 UserResource（登录态）拿头像与全名
    if (value && value.username && !value.avatar) {
      try {
        const profile = await callResource({
          resource: 'UserResource/get/',
          sourcePath: `/${value.username}/`,
          data: {
            options: { username: value.username, field_set_key: 'profile', is_mobile_feed: false },
            context: {},
          },
          handler: 'www/[username].js',
          label: '读取登录用户资料',
        });
        const user =
          profile && profile.json && profile.json.resource_response && profile.json.resource_response.data;
        if (user && typeof user === 'object') {
          const avatar =
            user.image_xlarge_url || user.image_large_url || user.image_medium_url || user.image_small_url || '';
          value = {
            username: typeof user.username === 'string' && user.username ? user.username : value.username,
            name: value.name || (typeof user.full_name === 'string' ? collapseWhitespace(user.full_name) : ''),
            avatar,
            pinCount: Number(user.pin_count) || 0,
            boardCount: Number(user.board_count) || 0,
          };
        }
      } catch {
        /* 头像只是增强，失败保持已有 viewer 信息 */
      }
    }

    viewerCache = { at: Date.now(), value };
    return value;
  }

  /**
   * 当前登录用户自己的 Pin(个人主页「已创建」那张网格)。
   * 需要登录态;username 不传时用 viewer() 缓存里的用户名。
   * @param {{ username?: string, bookmark?: string, limit?: number }} params
   * @returns {Promise<{ pins: object[], bookmark: string|null, username: string }>}
   */
  async function userPins({ username, bookmark, limit = 24 } = {}) {
    if (!hasLoginCookies()) {
      throw new PinterestError('需要登录 Pinterest', { status: 401, code: 'EAUTH' });
    }
    let handle = typeof username === 'string' ? username.trim().replace(/^@/, '') : '';
    if (!handle) {
      const me = await viewer();
      handle = (me && me.username) || '';
    }
    if (!handle) {
      throw new PinterestError('拿不到当前登录用户的用户名,请重新登录', { status: 401, code: 'EAUTH' });
    }
    await ensureSession();
    const size = normalizeLimit(limit);
    const options = {
      username: handle,
      field_set_key: 'grid_item',
      page_size: size,
      is_own_profile_pins: true,
    };
    if (bookmark) options.bookmarks = [bookmark];
    const data = { options, context: {} };

    const attempts = [
      { resource: 'UserPinsResource/get/', sourcePath: `/${handle}/`, handler: 'www/[username].js' },
      { resource: 'UserPinsResource/get/', sourcePath: `/${handle}/_pins/`, handler: 'www/[username]/_pins.js' },
    ];
    let lastError = null;
    for (const attempt of attempts) {
      let res;
      try {
        res = await callResource({ ...attempt, data, label: '读取我的 Pin' });
      } catch (error) {
        lastError = error;
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        throw new PinterestError('需要重新登录 Pinterest', { status: res.status, code: 'EAUTH' });
      }
      if (!res.json) {
        lastError = new PinterestError(`读取我的 Pin 失败(HTTP ${res.status})`, {
          status: res.status,
          code: 'EUPSTREAM',
        });
        continue;
      }
      const response = res.json.resource_response;
      if (!response || response.error) {
        lastError = new PinterestError(
          response && response.error && response.error.message ? `读取我的 Pin 失败:${response.error.message}` : '读取我的 Pin 失败',
          { code: 'EUPSTREAM' }
        );
        continue;
      }
      const rawList = Array.isArray(response.data) ? response.data : [];
      const pins = rawList
        .map((raw) => {
          try {
            return normalizePin(raw);
          } catch {
            return null;
          }
        })
        .filter((pin) => pin && pin.id && pin.image);
      return { pins, bookmark: response.bookmark || null, username: handle };
    }
    throw lastError || new PinterestError('读取我的 Pin 失败', { code: 'EUPSTREAM' });
  }

  return { search, related, resolveUrl, health, feed, probe, viewer, userPins, importCookies, exportCookies, clearCookies };
}

export default createPinterestClient;
