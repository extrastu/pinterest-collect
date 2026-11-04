#!/usr/bin/env node
/**
 * tools/verify/check.mjs — pinterest-collect 插件的合规验证脚本（零依赖，Node 22+）
 *
 * 插件版本：v1.1（去掉「推荐分类 /topics」，新增「登录 Pinterest → 个性化推荐流」）。
 *
 * 规范口径：不启动浏览器、不读取/搜索鉴权 token、不碰个人浏览器 profile、不模拟 React、
 *           不做 mock/静态预览页。所有验证都走「安装清单 / Host HTTP API / 客户端产物静态检查」。
 *           唯一的写操作是 B5 的临时收藏（验证后 unsave 还原）与 B10 的 logout（无登录态时才执行）。
 *
 * 用法：
 *   node tools/verify/check.mjs                 # 人类可读的 PASS/FAIL 表
 *   node tools/verify/check.mjs --json out.json # 附带机器可读报告
 *   node tools/verify/check.mjs --base http://127.0.0.1:52011
 *   node tools/verify/check.mjs --budget 60000  # 时间预算（毫秒，默认 60000，即 60s）
 *
 * 退出码：全部 PASS（或 SKIP）→ 0；存在 FAIL → 1。
 *
 * 覆盖 15 项：
 *   A 安装与清单   A1 bundles+符号链接  A2 包清单  A3 locale/icon
 *   B Host 侧      B4  /topics 已移除（404）+ /collection 结构
 *                  B5  收藏 → 查询 → unsave 还原（B5 必须还原，不留测试数据）
 *                  B6  未知路由 404 / 垃圾 body 400 JSON / 服务不崩
 *                  B7  /health + /account 契约（version semver / authReady / account 字段类型）
 *                  B8  /feed 未登录：authReady=false → 503+中文；true → 401
 *                  B9  登录窗口入口：login/start（无 Chrome → 409+中文；有 Chrome → SKIP，绝不弹窗）
 *                  B10 凭据与退出：cookies 垃圾串 → 400 或 503（取决于 authReady，不得 500）
 *                      + logout → 200/connected:false + 不留下 session.json
 *   C 客户端静态   C11 node --check + parts / 内嵌 CSS 与构建产物同步
 *                  C12 只 require('react') + 无危险写法
 *                  C13 panel.css 颜色合规（v1.1 白名单）
 *                  C14 Slot 注册 + PcErrorBoundary
 *                  C15 v1.1 账号/登录/推荐 UI 静态标记（无 /topics 遗留、PcLoginDialog、账号栏、
 *                      login 卡片、pcFetch('/account') 与 /feed 调用）
 *
 * 降级分支：authReady=false 表示 Host 侧登录/推荐模块还没加载。此时 B8（/feed）与 B10（cookies）
 *           只能按 503 分支验证，脚本会 PASS 但把它们记入「降级分支」，登录模块就绪后需要重跑。
 */

import { readFileSync, readdirSync, statSync, lstatSync, realpathSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '../..');
/** monorepo 仓库根:安装入口(root package.json 声明 dsh.bundle,exports 指向 packages/plugin)。 */
const REPO_ROOT = resolve(PROJECT_ROOT, '../..');
const HOME = process.env.HOME || homedir();
const DSH_HOME = process.env.DSH_HOME || join(HOME, '.dsh');
const PROFILE_DIR = process.env.DSH_PROFILE_DIR || join(DSH_HOME, 'profiles/desktop');
const DATA_DIR = process.env.PINTEREST_DATA_DIR || join(DSH_HOME, 'pinterest-collect');
const SESSION_PATH = join(DATA_DIR, 'session.json');

const argv = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
const BASE = String(getArg('base', process.env.DSH_WEB_URL || 'http://127.0.0.1:52011')).replace(/\/$/, '');
const JSON_OUT = typeof getArg('json', null) === 'string' ? getArg('json', null) : null;
const TIME_BUDGET_MS = Number(getArg('budget', 60000)) || 60000;

const results = [];
/** 只能按降级分支验证的项（authReady=false），登录模块就绪后需要重跑。 */
const DEGRADED = [];
const runtime = {
  version: null,
  authReady: null,
  connected: null,
  chromeAvailable: null,
  chromeName: null,
  feedStatus: null,
};
const started = Date.now();
const elapsed = () => `${Date.now() - started}ms`;

function record(id, title, status, evidence, extra) {
  results.push({ id, title, status, evidence, extra, elapsedMs: Date.now() - started });
  const mark = status === 'PASS' ? '✔' : status === 'FAIL' ? '✖' : '•';
  console.log(`${mark} [${id}] ${title}`);
  for (const line of String(evidence).split('\n')) console.log(`    ${line}`);
}

/** 跑一个异步检查；抛错自动记 FAIL。 */
async function check(id, title, fn) {
  if (Date.now() - started > TIME_BUDGET_MS) {
    record(id, title, 'SKIP', `跳过：超出时间预算 ${TIME_BUDGET_MS}ms`);
    return;
  }
  try {
    const r = await fn();
    if (r && r.degraded) DEGRADED.push({ id, reason: String(r.degraded) });
    record(id, title, r.status || 'PASS', r.evidence, r.extra);
  } catch (e) {
    record(id, title, 'FAIL', `异常：${e && e.message ? e.message : e}`);
  }
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const rel = (p) => p.replace(PROJECT_ROOT + '/', '');
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;
const isStr = (v) => typeof v === 'string';
const isBool = (v) => typeof v === 'boolean';
const clip = (s, n = 180) => {
  const t = String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
const bodyBrief = (r) => `${r.status} ${clip(r.text, 180)}`;
/** 中文提示：error 里至少出现一个汉字。 */
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const hasCJK = (v) => isStr(v) && CJK_RE.test(v);
/** 语义化版本号（允许 pre-release / build 后缀）。 */
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

async function http(method, pathname, body, { timeout = 12000 } = {}) {
  const url = BASE + pathname;
  // 单条请求超时不超过剩余时间预算，保证整脚本在 --budget（默认 60s）内收尾
  const remaining = Math.max(1000, TIME_BUDGET_MS - (Date.now() - started));
  const effectiveTimeout = Math.min(timeout, remaining);
  const opts = { method, signal: AbortSignal.timeout(effectiveTimeout) };
  if (body !== undefined) {
    opts.headers = { 'content-type': 'application/json' };
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, contentType: res.headers.get('content-type') || '', text, json, pathname };
}

// ---------------------------------------------------------------- 数据安全工具

/**
 * 登录态文件快照：只 stat 大小 / 权限 / mtime，**绝不读取内容**（里面是 cookie）。
 * 测试前后各取一次，用于证明测试没有写入或删除用户的 session.json。
 */
function sessionInfo() {
  try {
    const st = statSync(SESSION_PATH);
    return { exists: true, size: st.size, mode: (st.mode & 0o777).toString(8), mtimeMs: st.mtimeMs };
  } catch (e) {
    return { exists: false, code: (e && e.code) || 'unknown' };
  }
}
const sessionLabel = (s) => (s.exists ? `存在(${s.size}B, mode=${s.mode})` : '不存在');

// ---------------------------------------------------------------- A. 安装与清单

async function checkA1() {
  const pkgPath = join(PROFILE_DIR, 'package.json');
  const pkg = readJson(pkgPath);
  const bundles = pkg?.dsh?.profile?.bundles || [];
  const inBundles = bundles.includes('pinterest-collect');
  const dep = pkg?.dependencies?.['pinterest-collect'];
  const linkPath = join(PROFILE_DIR, 'node_modules/pinterest-collect');
  let isLink = false;
  let isDir = false;
  let real = '';
  try {
    const stat = lstatSync(linkPath);
    isLink = stat.isSymbolicLink();
    isDir = stat.isDirectory();
    real = realpathSync(linkPath);
  } catch (e) {
    throw new Error(`node_modules/pinterest-collect 不可访问：${e.message}`);
  }
  let repoReal = '';
  try {
    repoReal = realpathSync(REPO_ROOT);
  } catch {
    repoReal = '';
  }
  // 除了本地源码链接,也接受从 GitHub 安装的插件包:依赖名一致且声明了 dsh.bundle 即可
  let installedManifest = null;
  try {
    installedManifest = readJson(join(linkPath, 'package.json'));
  } catch {
    installedManifest = null;
  }
  const bundleOk =
    !!installedManifest &&
    installedManifest.name === 'pinterest-collect' &&
    installedManifest.dsh !== undefined &&
    installedManifest.dsh.bundle !== undefined &&
    typeof installedManifest.dsh.bundle.patch === 'string';
  const localLink = real === repoReal || real === realpathSync(PROJECT_ROOT);
  const targetOk = localLink || bundleOk;
  const ok = inBundles && (isLink || isDir) && targetOk;
  return {
    status: ok ? 'PASS' : 'FAIL',
    evidence:
      `${rel(pkgPath)}\n` +
      `  dsh.profile.bundles 含 pinterest-collect: ${inBundles}（共 ${bundles.length} 个 bundle，位置 #${bundles.indexOf('pinterest-collect')}）\n` +
      `  dependencies.pinterest-collect: ${JSON.stringify(dep)}\n` +
      `  node_modules/pinterest-collect: 符号链接=${isLink} 目录=${isDir} → realpath: ${real}\n` +
      `  安装形态: ${localLink ? '本地仓库链接' : bundleOk ? '已安装的插件包(GitHub / npm)' : '无法识别'}（本地期望仓库根 ${repoReal} 或源码包 ${realpathSync(PROJECT_ROOT)}）`,
    extra: { inBundles, isLink, targetOk, real, localLink, bundleOk },
  };
}

async function checkA2() {
  const pkgPath = join(REPO_ROOT, 'package.json');
  const pkg = readJson(pkgPath);
  const exportsMap = pkg.exports || {};
  const needKeys = ['.', './client', './locale/*.json', './icon'];
  const missingKeys = needKeys.filter((k) => !(k in exportsMap));
  const resolveExport = (k) => {
    const v = exportsMap[k];
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') return v.import || v.require || v.default || null;
    return null;
  };
  const missingFiles = [];
  for (const k of needKeys) {
    const target = resolveExport(k);
    if (!target) {
      missingFiles.push(`${k} → (无目标)`);
      continue;
    }
    if (k.endsWith('/*.json')) {
      // 通配 exports(如 ./locale/*.json):检查通配目录下至少有一个 json
      const wildcardDir = join(REPO_ROOT, dirname(target));
      try {
        const files = readdirSync(wildcardDir).filter((f) => f.endsWith('.json'));
        if (!files.length) missingFiles.push(`${k} → ${dirname(target)} 下没有 json`);
      } catch {
        missingFiles.push(`${k} → ${dirname(target)} 目录不存在`);
      }
      continue;
    }
    const abs = join(REPO_ROOT, target.replace(/^\.\//, ''));
    try {
      if (!statSync(abs).isFile()) missingFiles.push(`${k} → ${target} 不是文件`);
    } catch {
      missingFiles.push(`${k} → ${target} 不存在`);
    }
  }
  const patch = pkg?.dsh?.bundle?.patch;
  const patchExists = patch ? (() => {
    try {
      return statSync(join(REPO_ROOT, patch)).isFile();
    } catch {
      return false;
    }
  })() : false;
  // client bundle 以「包名」作为浏览器模块 id,必须等于客户端产物里注册的 id
  const packageName = pkg?.name;
  const nameOk = packageName === 'pinterest-collect';
  const platform = pkg?.dsh?.client?.platform;
  const ok = missingKeys.length === 0 && missingFiles.length === 0 && patchExists && platform === 'web' && nameOk;
  return {
    status: ok ? 'PASS' : 'FAIL',
    evidence:
      `exports keys: ${Object.keys(exportsMap).join(', ')}\n` +
      `  缺失 key: ${missingKeys.length ? missingKeys.join(', ') : '无'}\n` +
      `  目标文件缺失: ${missingFiles.length ? missingFiles.join(' ; ') : '无'}\n` +
      `  dsh.bundle.patch: ${JSON.stringify(patch)} → 文件存在=${patchExists}（相对仓库根 ${REPO_ROOT}）\n` +
      `  dsh.client.platform: ${JSON.stringify(platform)}（期望 "web"）\n` +
      `  包名: ${JSON.stringify(packageName)}（客户端 bundle id 需要是 pinterest-collect）`,
    extra: { missingKeys, missingFiles, patchExists, platform, packageName },
  };
}

async function checkA3() {
  const problems = [];
  const evidence = [];
  for (const lang of ['en', 'zh']) {
    const p = join(PROJECT_ROOT, 'locale', `${lang}.json`);
    try {
      const j = readJson(p);
      const t = j?.meta?.title;
      const d = j?.meta?.description;
      evidence.push(`locale/${lang}.json: meta.title=${JSON.stringify(t)} meta.description=${JSON.stringify(d)}`);
      if (typeof t !== 'string' || !t.trim()) problems.push(`${lang}.json meta.title 缺失或空`);
      if (typeof d !== 'string' || !d.trim()) problems.push(`${lang}.json meta.description 缺失或空`);
    } catch (e) {
      problems.push(`locale/${lang}.json 解析失败: ${e.message}`);
    }
  }
  const iconPath = join(PROJECT_ROOT, 'icon.svg');
  try {
    const buf = readFileSync(iconPath);
    const text = buf.toString('utf8').trim();
    const size = buf.length;
    const startsSvg = /^<svg[\s>]/.test(text);
    const hasViewBox = /viewBox\s*=\s*["'][^"']+["']/.test(text);
    const hasClosing = /<\/svg>\s*$/.test(text);
    const sizeOk = size < 256 * 1024;
    evidence.push(`icon.svg: ${size} bytes，以 <svg 开头=${startsSvg}，含 viewBox=${hasViewBox}，闭合=${hasClosing}，<256KiB=${sizeOk}`);
    if (!startsSvg) problems.push('icon.svg 不以 <svg 开头');
    if (!hasViewBox) problems.push('icon.svg 没有 viewBox');
    if (!hasClosing) problems.push('icon.svg 没有 </svg> 结尾');
    if (!sizeOk) problems.push(`icon.svg 体积 ${size} ≥ 256KiB`);
  } catch (e) {
    problems.push(`icon.svg 不可读: ${e.message}`);
  }
  return {
    status: problems.length ? 'FAIL' : 'PASS',
    evidence: evidence.join('\n') + (problems.length ? `\n  问题: ${problems.join(' ; ')}` : ''),
    extra: { problems },
  };
}

// ---------------------------------------------------------------- B. Host 侧

function validateBoard(b, where) {
  const errs = [];
  if (!b || typeof b !== 'object') return [`${where} 不是对象`];
  if (!isStr(b.id) || !b.id) errs.push(`${where}.id 缺失`);
  if (!isStr(b.title)) errs.push(`${where}.title 不是字符串`);
  if (!isStr(b.createdAt)) errs.push(`${where}.createdAt 不是字符串`);
  if (!isBool(b.isDefault)) errs.push(`${where}.isDefault 不是布尔`);
  return errs;
}

function validateCollection(j) {
  const errs = [];
  if (!j || typeof j !== 'object') return ['响应不是对象'];
  if (!Array.isArray(j.boards)) errs.push('boards 不是数组');
  else j.boards.forEach((b, i) => errs.push(...validateBoard(b, `boards[${i}]`)));
  if (!Array.isArray(j.pins)) errs.push('pins 不是数组');
  else {
    j.pins.forEach((p, i) => {
      if (!p || typeof p !== 'object') return errs.push(`pins[${i}] 不是对象`);
      if (!isStr(p.savedId) || !p.savedId) errs.push(`pins[${i}].savedId 缺失`);
      if (!isStr(p.id) || !p.id) errs.push(`pins[${i}].id 缺失`);
      if (!isStr(p.image)) errs.push(`pins[${i}].image 不是字符串`);
    });
  }
  if (!(j.activeBoardId === null || isStr(j.activeBoardId))) errs.push('activeBoardId 不是 string|null');
  return errs;
}

/** /account 字段集合（CONTRACT v1.1）：每个字段必须存在且类型正确。 */
const ACCOUNT_FIELDS = {
  connected: (v) => isBool(v),
  valid: (v) => isBool(v),
  updatedAt: (v) => v === null || isStr(v),
  authReady: (v) => isBool(v),
  chromeAvailable: (v) => isBool(v),
  chromeName: (v) => v === null || isStr(v),
};

function validateAccount(j, where = 'account') {
  const errs = [];
  if (!j || typeof j !== 'object' || Array.isArray(j)) return [`${where} 不是对象`];
  for (const [key, typeOk] of Object.entries(ACCOUNT_FIELDS)) {
    if (!(key in j)) errs.push(`${where}.${key} 缺失`);
    else if (!typeOk(j[key])) errs.push(`${where}.${key} 类型错误（${JSON.stringify(j[key])}）`);
  }
  if (isStr(j && j.updatedAt) && Number.isNaN(Date.parse(j.updatedAt))) {
    errs.push(`${where}.updatedAt 不是可解析的时间字符串`);
  }
  return errs;
}

/** B4：v1.1 已删除 /topics（必须 404）；收藏接口结构保持不变。 */
async function checkB4() {
  const topics = await http('GET', '/pinterest-api/topics');
  const collection = await http('GET', '/pinterest-api/collection');
  const problems = [];
  const evidence = [];

  evidence.push(`GET /pinterest-api/topics → ${bodyBrief(topics)}（v1.1 已移除，期望 404）`);
  if (topics.status !== 404) problems.push(`/topics HTTP ${topics.status}（期望 404，接口已移除）`);
  if (topics.json === null) problems.push('/topics 响应不是 JSON');
  else if (!isStr(topics.json.error)) problems.push('/topics 404 body 缺少 error 字符串');

  evidence.push(
    `GET /pinterest-api/collection → ${collection.status}，boards=${collection.json?.boards?.length ?? '?'} pins=${collection.json?.pins?.length ?? '?'} activeBoardId=${JSON.stringify(collection.json?.activeBoardId)}`,
  );
  if (collection.status !== 200) problems.push(`/collection HTTP ${collection.status}`);
  else problems.push(...validateCollection(collection.json));

  return {
    status: problems.length ? 'FAIL' : 'PASS',
    evidence: evidence.join('\n') + (problems.length ? `\n  问题: ${problems.join(' ; ')}` : ''),
    extra: { topicsStatus: topics.status, problems },
  };
}

const TEST_PIN_ID = `verify-check-${Date.now()}`;
const testPin = {
  id: TEST_PIN_ID,
  title: 'check.mjs 临时验证 Pin（会自动删除）',
  description: '由 tools/verify/check.mjs 写入，验证后立即 unsave；如残留可安全删除。',
  image: 'https://i.pinimg.com/474x/00/00/00/00000000000000000000000000000000.jpg',
  imageLarge: 'https://i.pinimg.com/736x/00/00/00/00000000000000000000000000000000.jpg',
  width: 474,
  height: 592,
  dominantColor: '#dddddd',
  pinUrl: `https://www.pinterest.com/pin/${TEST_PIN_ID}/`,
  sourceUrl: '',
  siteName: 'check.mjs',
  pinner: { name: 'verify', username: 'verify' },
  board: { name: '', url: '' },
  isVideo: false,
};

/** B5：临时收藏 → 查询可见 → unsave 还原；必须恢复到写入前的 savedId 集合。 */
async function checkB5() {
  const before = await http('GET', '/pinterest-api/collection');
  if (before.status !== 200 || !Array.isArray(before.json?.pins)) {
    return { status: 'FAIL', evidence: `无法读取原始 collection（HTTP ${before.status}），为避免破坏用户数据，跳过写入测试。` };
  }
  const beforeIds = new Set(before.json.pins.map((p) => p.savedId));
  const beforePinIds = new Set(before.json.pins.map((p) => p.id));
  const evidence = [`写入前: boards=${before.json.boards.length} pins=${before.json.pins.length}`];

  // 若同一 pin 已在收藏里，跳过以避免破坏用户数据
  if (beforePinIds.has(TEST_PIN_ID)) {
    return { status: 'SKIP', evidence: evidence.concat('测试 pin 已存在于收藏中，按约定跳过（不碰用户数据）。').join('\n') };
  }

  let savedId = null;
  let savedOk = false;
  let inCollection = false;
  let restored = false;
  let cleanupError = null;
  try {
    const save = await http('POST', '/pinterest-api/save', { pin: testPin });
    evidence.push(`POST /save → ${save.status} ${JSON.stringify(save.json)?.slice(0, 300)}`);
    if (save.status !== 200) throw new Error(`save HTTP ${save.status}: ${save.text.slice(0, 200)}`);
    if (!save.json?.saved || !save.json.saved.savedId) throw new Error('save 响应缺少 saved.savedId');
    savedId = save.json.saved.savedId;
    savedOk = true;

    const mid = await http('GET', '/pinterest-api/collection');
    inCollection = (mid.json?.pins || []).some((p) => p.savedId === savedId);
    evidence.push(`写入后 GET /collection → ${mid.status}，pins=${mid.json?.pins?.length}，含新收藏=${inCollection}（savedId=${savedId}）`);
    if (!inCollection) throw new Error('保存后 collection 中查不到该 savedId');

    const unsave = await http('POST', '/pinterest-api/unsave', { savedId });
    evidence.push(`POST /unsave → ${unsave.status} ${JSON.stringify(unsave.json)?.slice(0, 200)}`);
    if (unsave.status !== 200) throw new Error(`unsave HTTP ${unsave.status}: ${unsave.text.slice(0, 200)}`);
  } catch (e) {
    evidence.push(`写入/清理过程异常: ${e.message}`);
    cleanupError = e;
  } finally {
    // 无论成败，只要保存成功就尝试删掉，避免留下测试数据
    if (savedOk && savedId) {
      try {
        const again = await http('GET', '/pinterest-api/collection');
        const stillThere = (again.json?.pins || []).some((p) => p.savedId === savedId);
        if (stillThere) await http('POST', '/pinterest-api/unsave', { savedId });
      } catch {}
    }
  }

  const after = await http('GET', '/pinterest-api/collection');
  const afterIds = new Set((after.json?.pins || []).map((p) => p.savedId));
  const leftover = [...afterIds].filter((id) => !beforeIds.has(id));
  restored = leftover.length === 0;
  evidence.push(`恢复校验: pins ${before.json.pins.length} → ${afterIds.size}，残留测试数据=${leftover.length ? leftover.join(',') : '无'}`);

  const ok = savedOk && inCollection && restored && !cleanupError;
  if (!ok) {
    evidence.push('⚠ 如果这里失败，请立刻人工检查 /pinterest-api/collection 是否残留 test pin：' + TEST_PIN_ID);
  }
  return { status: ok ? 'PASS' : 'FAIL', evidence: evidence.join('\n'), extra: { savedId, restored, leftover } };
}

/** B6：未知路由 404 JSON；垃圾 body 400 JSON；随后服务仍健康。 */
async function checkB6() {
  const notFound = await http('GET', '/pinterest-api/definitely-not-a-route');
  const badJson = await http('POST', '/pinterest-api/save', 'not-json{{{', { timeout: 15000 });
  const garbageShape = await http('POST', '/pinterest-api/save', { pin: 'garbage' });
  const healthAfter = await http('GET', '/pinterest-api/health');
  const problems = [];
  if (notFound.status !== 404) problems.push(`未知路由 HTTP ${notFound.status}（期望 404）`);
  if (!notFound.contentType.includes('application/json')) problems.push(`未知路由 content-type=${notFound.contentType}（期望 json）`);
  if (!notFound.json || !isStr(notFound.json.error)) problems.push('未知路由 body 缺少 error 字符串');
  if (badJson.status !== 400) problems.push(`垃圾 body POST /save HTTP ${badJson.status}（期望 400）`);
  if (!badJson.contentType.includes('application/json')) problems.push(`垃圾 body content-type=${badJson.contentType}（期望 json）`);
  if (!badJson.json || !isStr(badJson.json.error)) problems.push('垃圾 body 响应缺少 error 字符串');
  if (garbageShape.status !== 400) problems.push(`pin 为字符串 POST /save HTTP ${garbageShape.status}（期望 400）`);
  if (healthAfter.status !== 200 || healthAfter.json?.ok !== true) problems.push('400/404 之后 health 不再 OK（可能崩溃）');
  return {
    status: problems.length ? 'FAIL' : 'PASS',
    evidence:
      `GET /definitely-not-a-route → ${notFound.status} ${notFound.text.slice(0, 120)}\n` +
      `POST /save body=not-json{{{ → ${badJson.status} ${badJson.text.slice(0, 120)}\n` +
      `POST /save body={"pin":"garbage"} → ${garbageShape.status} ${garbageShape.text.slice(0, 120)}\n` +
      `随后 GET /health → ${healthAfter.status}（服务未崩溃）\n` +
      `  问题: ${problems.length ? problems.join(' ; ') : '无'}`,
    extra: { problems },
  };
}

/** B7：/health 与 /account 的 v1.1 契约（version semver / authReady 布尔 / account 字段集合）。 */
async function checkB7() {
  const health = await http('GET', '/pinterest-api/health');
  const account = await http('GET', '/pinterest-api/account');
  const problems = [];
  const evidence = [];

  evidence.push(`GET /health → ${health.status} ${clip(health.text, 220)}`);
  if (health.status !== 200) problems.push(`/health HTTP ${health.status}`);
  if (!health.contentType.includes('application/json')) problems.push(`/health content-type=${health.contentType}（期望 JSON）`);
  if (!health.json || typeof health.json !== 'object') {
    problems.push('/health 响应不是 JSON 对象');
  } else {
    const h = health.json;
    if (h.ok !== true) problems.push('health.ok !== true');
    if (!isStr(h.version)) problems.push('health.version 不是字符串');
    else if (!SEMVER_RE.test(h.version)) problems.push(`health.version=${JSON.stringify(h.version)} 不是 semver 字符串`);
    if (!isBool(h.authReady)) problems.push('health.authReady 不是布尔');
    if (!h.account || typeof h.account !== 'object' || Array.isArray(h.account)) {
      problems.push('health.account 不是对象');
    } else {
      // 契约只要求 health.account 是对象；字段类型在 GET /account 上逐项校验（见下）
      const missing = Object.keys(ACCOUNT_FIELDS).filter((k) => !(k in h.account));
      evidence.push(`  health.account 字段: ${missing.length ? `缺 ${missing.join(',')}（不判 FAIL）` : '完整'}`);
    }
    runtime.version = isStr(h.version) ? h.version : runtime.version;
    runtime.authReady = isBool(h.authReady) ? h.authReady : runtime.authReady;
  }

  evidence.push(`GET /account → ${account.status} ${clip(account.text, 220)}`);
  if (account.status !== 200) problems.push(`/account HTTP ${account.status}`);
  if (!account.contentType.includes('application/json')) problems.push(`/account content-type=${account.contentType}（期望 JSON）`);
  if (!account.json || typeof account.json !== 'object') {
    problems.push('/account 响应不是 JSON 对象');
  } else {
    problems.push(...validateAccount(account.json, 'account'));
    const a = account.json;
    runtime.authReady = isBool(a.authReady) ? a.authReady : runtime.authReady;
    runtime.connected = isBool(a.connected) ? a.connected : runtime.connected;
    runtime.chromeAvailable = isBool(a.chromeAvailable) ? a.chromeAvailable : runtime.chromeAvailable;
    runtime.chromeName = a.chromeName === undefined ? runtime.chromeName : a.chromeName;
    evidence.push(
      `  字段: connected=${JSON.stringify(a.connected)} valid=${JSON.stringify(a.valid)} authReady=${JSON.stringify(a.authReady)} ` +
        `chromeAvailable=${JSON.stringify(a.chromeAvailable)} chromeName=${JSON.stringify(a.chromeName)} updatedAt=${JSON.stringify(a.updatedAt)}`,
    );
  }

  return {
    status: problems.length ? 'FAIL' : 'PASS',
    evidence: evidence.join('\n') + (problems.length ? `\n  问题: ${problems.join(' ; ')}` : ''),
    extra: { version: runtime.version, authReady: runtime.authReady, problems },
  };
}

/**
 * B8：GET /feed 未登录时的行为。
 *   authReady===false → 503（推荐模块未就绪，中文提示）——降级分支
 *   authReady===true  → 401（需要登录）
 * 若当前已真实登录（connected=true），跳过：不能为了测试把用户踢下线。
 */
async function checkB8() {
  const health = await http('GET', '/pinterest-api/health');
  const authReady = health.json?.authReady;
  const connected = health.json?.account?.connected === true;
  const evidence = [`GET /health → ${health.status} authReady=${JSON.stringify(authReady)} account.connected=${connected}`];
  const problems = [];

  if (!isBool(authReady)) {
    return {
      status: 'FAIL',
      evidence: evidence.concat('health.authReady 不是布尔，无法判断 /feed 应按哪条分支验证').join('\n'),
    };
  }
  if (connected) {
    return {
      status: 'SKIP',
      evidence: evidence.concat('当前已有真实登录态（connected=true），不请求 /feed（避免影响用户推荐流）；「未登录」分支留待退出登录后验证。').join('\n'),
      extra: { authReady, connected },
    };
  }

  const feed = await http('GET', '/pinterest-api/feed', undefined, { timeout: 15000 });
  runtime.feedStatus = feed.status;
  evidence.push(`GET /feed → ${bodyBrief(feed)}`);
  let degraded;

  if (authReady === false) {
    if (feed.status !== 503) problems.push(`authReady=false 时 /feed HTTP ${feed.status}（期望 503）`);
    if (!(feed.json && hasCJK(feed.json.error))) problems.push('authReady=false 时 /feed 503 body 缺少中文 error');
    degraded = 'authReady=false：推荐流模块未就绪，/feed 只能按 503 降级分支验证；登录模块就绪后需重跑（应返回 401）';
  } else {
    if (feed.status !== 401) problems.push(`authReady=true 且未登录时 /feed HTTP ${feed.status}（期望 401）`);
    if (!(feed.json && isStr(feed.json.error))) problems.push('authReady=true 且未登录时 /feed 401 body 缺少 error 字符串');
  }

  return {
    status: problems.length ? 'FAIL' : 'PASS',
    evidence: evidence.join('\n') + (problems.length ? `\n  问题: ${problems.join(' ; ')}` : ''),
    extra: { authReady, connected, feedStatus: feed.status },
    degraded,
  };
}

/**
 * B9：登录窗口入口的降级行为（只测入口，绝不启动浏览器）。
 *   - chromeAvailable===true  → SKIP（真的调用会弹出 Chrome 登录窗口）
 *   - chromeAvailable===false → 409 + 中文 error
 * 同时确认这个调用不会写 session.json。
 */
async function checkB9() {
  const account = await http('GET', '/pinterest-api/account');
  const chromeAvailable = account.json?.chromeAvailable;
  const sessionBefore = sessionInfo();
  const evidence = [`GET /account → ${account.status} chromeAvailable=${JSON.stringify(chromeAvailable)}`];
  const problems = [];

  if (chromeAvailable !== false) {
    evidence.push(
      chromeAvailable === true
        ? 'POST /account/login/start → SKIP：本机检测到 Chrome，调用会真的弹出登录窗口；验证脚本不启动浏览器' +
            '（登录窗口/推荐流由 node tools/login-cdp-test.mjs 离屏覆盖）'
        : `POST /account/login/start → SKIP：无法确定 chromeAvailable(${JSON.stringify(chromeAvailable)})，不冒险触发浏览器启动`,
    );
    return { status: 'SKIP', evidence: evidence.join('\n'), extra: { chromeAvailable, skipped: true } };
  }

  const start = await http('POST', '/pinterest-api/account/login/start', {}, { timeout: 10000 });
  evidence.push(`POST /account/login/start → ${bodyBrief(start)}（chromeAvailable=${JSON.stringify(chromeAvailable)}，期望 409 + 中文提示）`);
  if (start.status !== 409) problems.push(`无 Chrome 时 login/start HTTP ${start.status}（期望 409）`);
  if (!(start.json && hasCJK(start.json.error))) problems.push('无 Chrome 时 login/start 缺少中文 error');
  if (start.json && start.json.code !== undefined) evidence.push(`  响应 code=${JSON.stringify(start.json.code)}（契约期望 ENOCHROME，仅提示）`);

  const sessionAfter = sessionInfo();
  evidence.push(`session.json（请求前后）: ${sessionLabel(sessionBefore)} / ${sessionLabel(sessionAfter)}`);
  if (!sessionBefore.exists && sessionAfter.exists) problems.push('login/start 后出现 session.json（未登录不应写入凭据）');
  if (sessionBefore.exists && !sessionAfter.exists) problems.push('login/start 删除了已存在的 session.json（用户登录态丢失）');

  return {
    status: problems.length ? 'FAIL' : 'PASS',
    evidence: evidence.join('\n') + (problems.length ? `\n  问题: ${problems.join(' ; ')}` : ''),
    extra: { chromeAvailable, loginStatus: start.status },
  };
}

/**
 * B10：凭据写入与退出登录的数据安全。
 *   1) POST /account/cookies 传垃圾 cookie 串（只用 _pinterest_sess=fake; _auth=0）：
 *      - authReady===true  → 400（不是登录态）
 *      - authReady===false → 503（登录模块未就绪）
 *      - 任何情况下不得 500；不得写入 session.json / 真实 cookie。
 *   2) POST /account/logout → 200 且 connected:false，并删除 session.json。
 * 破坏性保护：测前已有 session.json（或 connected=true）时跳过 cookies/logout，绝不登出真实账号。
 */
async function checkB10() {
  const accountBefore = await http('GET', '/pinterest-api/account');
  const authReady = accountBefore.json?.authReady;
  const connected = accountBefore.json?.connected === true;
  const sessionBefore = sessionInfo();
  const evidence = [
    `GET /account → ${accountBefore.status} authReady=${JSON.stringify(authReady)} connected=${connected}`,
    `session.json（测前）: ${sessionLabel(sessionBefore)}`,
  ];
  const problems = [];
  let attempted = 0;
  let degraded;
  let cookiesStatus = null;
  let logoutStatus = null;

  // 1) 垃圾 cookie 串
  if (connected) {
    evidence.push('POST /account/cookies → SKIP：账号已连接，不用垃圾 cookie 覆盖真实凭据');
  } else if (sessionBefore.exists) {
    evidence.push(`POST /account/cookies → SKIP：测前已存在 session.json(${sessionBefore.size}B)，按数据安全约定不写入凭据`);
  } else {
    attempted += 1;
    const cookies = await http('POST', '/pinterest-api/account/cookies', { cookieString: '_pinterest_sess=fake; _auth=0' }, { timeout: 20000 });
    cookiesStatus = cookies.status;
    evidence.push(`POST /account/cookies body={cookieString:"_pinterest_sess=fake; _auth=0"} → ${bodyBrief(cookies)}`);
    const expected = authReady === true ? 400 : 503;
    if (cookies.status === 500) {
      problems.push('POST /account/cookies 垃圾输入返回 500（不得 500）');
    } else if (cookies.status !== 400 && cookies.status !== 503) {
      problems.push(`POST /account/cookies HTTP ${cookies.status}（期望 400 或 503）`);
    } else if (isBool(authReady) && cookies.status !== expected) {
      problems.push(`authReady=${authReady} 时 cookies HTTP ${cookies.status}（期望 ${expected}）`);
    }
    if (!(cookies.json && isStr(cookies.json.error))) problems.push('cookies 4xx/5xx body 缺少 error 字符串');
    if (authReady === false) {
      degraded = 'authReady=false：/account/cookies 只能按 503 降级分支验证；登录模块就绪后需重跑（应返回 400）';
    }
    const sessionAfterCookies = sessionInfo();
    evidence.push(`session.json（cookies 后）: ${sessionLabel(sessionAfterCookies)}`);
    if (!sessionBefore.exists && sessionAfterCookies.exists) problems.push('cookies 测试后出现 session.json（不得留下测试凭据）');
    if (sessionBefore.exists && sessionAfterCookies.exists && (sessionBefore.size !== sessionAfterCookies.size || sessionBefore.mtimeMs !== sessionAfterCookies.mtimeMs)) {
      problems.push('cookies 测试改动了已存在的 session.json（可能覆盖用户凭据）');
    }
    if (sessionBefore.exists && !sessionAfterCookies.exists) problems.push('cookies 测试删除了已存在的 session.json（用户登录态丢失）');
  }

  // 2) logout（仅在没有真实登录态时执行，避免把用户踢下线）
  if (connected || sessionBefore.exists) {
    evidence.push('POST /account/logout → SKIP：为保护真实登录态不执行登出（如需验证请先由用户手动退出登录）');
  } else {
    attempted += 1;
    const logout = await http('POST', '/pinterest-api/account/logout', {}, { timeout: 10000 });
    logoutStatus = logout.status;
    evidence.push(`POST /account/logout → ${bodyBrief(logout)}`);
    if (logout.status !== 200) problems.push(`logout HTTP ${logout.status}（期望 200）`);
    if (!logout.json || logout.json.connected !== false) problems.push('logout 响应 connected 不是 false');
    if (logout.json && logout.json.ok !== true) evidence.push('  提示：logout 响应缺少 ok:true（CONTRACT 约定 { connected:false, ok:true }）');

    const accountAfter = await http('GET', '/pinterest-api/account');
    evidence.push(`GET /account（logout 后）→ ${accountAfter.status} connected=${JSON.stringify(accountAfter.json?.connected)}`);
    if (accountAfter.status !== 200) problems.push(`logout 后 /account HTTP ${accountAfter.status}`);
    else if (accountAfter.json?.connected !== false) problems.push('logout 后 /account.connected 不是 false');

    const sessionAfter = sessionInfo();
    evidence.push(`session.json（logout 后）: ${sessionLabel(sessionAfter)}`);
    if (sessionAfter.exists) problems.push('logout 后 session.json 仍存在（期望删除）');
  }

  const status = problems.length ? 'FAIL' : attempted === 0 ? 'SKIP' : 'PASS';
  return {
    status,
    evidence: evidence.join('\n') + (problems.length ? `\n  问题: ${problems.join(' ; ')}` : ''),
    extra: { attempted, authReady, connected, cookiesStatus, logoutStatus },
    degraded,
  };
}

// ---------------------------------------------------------------- C. 客户端静态检查

/** C11：client.js 是构建产物，必须能通过语法检查，且与 src/client/parts + panel.css 同步。 */
async function checkC11() {
  const clientPath = join(PROJECT_ROOT, 'client.js');
  const problems = [];
  const evidence = [];

  try {
    execFileSync(process.execPath, ['--check', clientPath], { stdio: 'pipe' });
  } catch (e) {
    const detail = ((e && e.stderr) || (e && e.stdout) || '').toString().slice(0, 600);
    problems.push('node --check client.js 失败');
    evidence.push(`node --check client.js → 失败:\n${detail}`);
  }
  const size = statSync(clientPath).size;
  if (!problems.length) evidence.push(`node --check client.js → 通过（${size} bytes）`);

  const clientSrc = readFileSync(clientPath, 'utf8');
  const flatClient = clientSrc.replace(/\s+/g, ' ');

  // parts 同步
  const partsDir = join(PROJECT_ROOT, 'src/client/parts');
  const parts = readdirSync(partsDir).filter((n) => n.endsWith('.js')).sort();
  const missing = [];
  for (const name of parts) {
    const body = readFileSync(join(partsDir, name), 'utf8').trim().replace(/\s+/g, ' ');
    if (!flatClient.includes(body.slice(0, 200))) missing.push(name);
  }
  const placeholder = clientSrc.includes('左侧收藏面板还在生成中');
  const markerOrder = [...clientSrc.matchAll(/\/\/ ---- src\/client\/parts\/([\w.-]+) ----/g)].map((m) => m[1]);
  const orderOk = markerOrder.length === parts.length && markerOrder.every((n, i) => n === parts[i]);
  evidence.push(`client.js parts 段: ${markerOrder.join(', ') || '(无)'}`);
  evidence.push(`src/client/parts 现有: ${parts.join(', ')}`);
  evidence.push(`  未嵌入 part: ${missing.length ? missing.join(', ') : '无'}；占位组件残留=${placeholder}；顺序一致=${orderOk}`);
  if (missing.length) problems.push(`client.js 未包含: ${missing.join(', ')}`);
  if (placeholder) problems.push('client.js 里仍有占位组件「左侧收藏面板还在生成中」');
  if (!orderOk) problems.push(`parts 顺序/数量不一致: client.js=[${markerOrder.join(',')}] 期望=[${parts.join(',')}]`);

  // 内嵌 CSS 同步（panel.css 改了但没重建 client.js 时，浏览器拿到的还是旧样式）
  const panelCss = readFileSync(join(PROJECT_ROOT, 'src/client/panel.css'), 'utf8').trim();
  const cssMatch = clientSrc.match(/const PC_CSS = ("(?:[^"\\]|\\.)*");/);
  let embeddedCss = null;
  let cssSynced = false;
  if (!cssMatch) {
    problems.push('client.js 中找不到 PC_CSS 常量（构建产物格式异常）');
  } else {
    try {
      embeddedCss = JSON.parse(cssMatch[1]);
      cssSynced = embeddedCss.trim() === panelCss;
      evidence.push(`内嵌 PC_CSS(${embeddedCss.length}B) 与 src/client/panel.css(${panelCss.length}B) 同步=${cssSynced}`);
      if (!cssSynced) problems.push('client.js 内嵌 CSS 与 panel.css 不一致（改完 panel.css 需重跑 node build-client.mjs）');
    } catch (e) {
      problems.push(`PC_CSS 不是合法 JSON 字符串: ${e.message}`);
    }
  }

  return {
    status: problems.length ? 'FAIL' : 'PASS',
    evidence: evidence.join('\n') + (problems.length ? `\n  问题: ${problems.join(' ; ')}\n  ⇒ 修复: node build-client.mjs` : ''),
    extra: { missing, placeholder, orderOk, cssSynced },
  };
}

function stripStringsAndComments(src) {
  // 去掉字符串/模板/注释，减少误报；返回同样长度的占位文本，便于定位行号
  const out = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/`(?:\\.|[^`\\])*`/g, (m) => ' '.repeat(m.length))
    .replace(/'(?:\\.|[^'\\])*'/g, (m) => ' '.repeat(m.length))
    .replace(/"(?:\\.|[^"\\])*"/g, (m) => ' '.repeat(m.length));
  return out;
}

/** 收集所有字符串/模板字面量的内容（去掉引号），用于检查 UI 文案遗留（注释不会被当成字面量）。 */
function stringLiteralContents(src) {
  const out = [];
  const re = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g;
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[0].slice(1, -1));
  return out;
}

/** C12：只 require('react')；无 document.body 写入 / dangerouslySetInnerHTML / eval。 */
async function checkC12() {
  const clientPath = join(PROJECT_ROOT, 'client.js');
  const src = readFileSync(clientPath, 'utf8');
  const code = stripStringsAndComments(src);
  const problems = [];

  const requires = [...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  const uniqueRequires = [...new Set(requires)];
  const badRequires = uniqueRequires.filter((r) => r !== 'react');
  if (badRequires.length) problems.push(`require 了非 react 模块: ${badRequires.join(', ')}`);

  const forbidden = [
    ['document.body.appendChild', /document\s*\.\s*body\s*\.\s*appendChild/],
    ['document.body.append/prepend/insertBefore', /document\s*\.\s*body\s*\.\s*(?:append|prepend|insertBefore)\b/],
    ['document.body.innerHTML', /document\s*\.\s*body\s*\.\s*innerHTML/],
    ['document.write', /document\s*\.\s*write\b/],
    ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
    ['eval(', /(^|[^.\w])eval\s*\(/],
    ['new Function(', /new\s+Function\s*\(/],
  ];
  const hits = [];
  for (const [name, re] of forbidden) {
    const m = re.exec(code);
    if (m) {
      hits.push(`${name} @ client.js:${lineOf(code, m.index)}`);
      problems.push(name);
    }
  }

  // 同一个 factory 里仍然只有 React 一个依赖
  const headStyle = /document\s*\.\s*head\s*\.\s*appendChild/.test(code);
  const evidence =
    `require(): ${uniqueRequires.length ? uniqueRequires.join(', ') : '(无)'}（期望只有 react）\n` +
    `禁止写法: ${hits.length ? hits.join(' ; ') : '未发现'}\n` +
    `document.head.appendChild(style) 样式注入: ${headStyle ? '有（规范允许）' : '无'}`;
  return { status: problems.length ? 'FAIL' : 'PASS', evidence, extra: { uniqueRequires, hits, problems } };
}

/** v1.1 颜色白名单（十六进制）：品牌红 #b32c48/#9c223d、登录徽章 #fff、详情媒体底 #101014。 */
const HEX_WHITELIST = new Set(['#b32c48', '#9c223d', '#fff', '#101014']);

/**
 * C13：panel.css 颜色合规。
 * 白名单：
 *   - 十六进制：#b32c48 / #9c223d / #fff / #101014
 *   - rgba(...)：阴影/蒙层（不限制三通道，但 rgb(...) 无 alpha 的语义色仍然禁止）
 *   - color-mix(...)：必须引用主题 token —— 直接 var(--dsw-alias-*)，
 *     或 panel.css 内定义的本地别名（如 --pc-danger: var(--dsw-alias-state-error-primary)）
 * 其余裸写十六进制 / rgb / hsl 语义色 → 违规。
 */
async function checkC13() {
  const cssPath = join(PROJECT_ROOT, 'src/client/panel.css');
  const css = readFileSync(cssPath, 'utf8');

  // 本地别名 → dsw alias（用于判断 color-mix 是否间接引用主题 token）
  const aliasToDsw = new Set();
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*var\(\s*--dsw-alias-[\w-]+\s*\)/g)) aliasToDsw.add(m[1]);

  const re = /color-mix\([^()]*(?:\([^()]*\)[^()]*)*\)|\brgba?\([^)]*\)|\bhsla?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g;
  const found = [];
  const violations = [];
  let directAliasRefs = (css.match(/var\(\s*--dsw-alias-/g) || []).length;
  let m;
  while ((m = re.exec(css)) !== null) {
    const raw = m[0];
    const lower = raw.replace(/\s+/g, '').toLowerCase();
    const line = lineOf(css, m.index);
    const context = css.split('\n')[line - 1].trim().slice(0, 110);
    let kind = 'other';
    let ok = false;
    let note = '';
    if (lower.startsWith('color-mix(')) {
      kind = 'color-mix';
      const direct = /var\(\s*--dsw-alias-[\w-]+\s*\)/.test(raw);
      const viaAlias = [...aliasToDsw].filter((a) => raw.includes(`var(${a})`));
      ok = direct || viaAlias.length > 0;
      note = direct
        ? '直接引用 var(--dsw-alias-*)'
        : viaAlias.length
          ? `经本地别名 ${viaAlias.join('/')} 间接引用 var(--dsw-alias-*)`
          : '未引用主题 token';
    } else if (lower.startsWith('rgba(')) {
      kind = 'rgba';
      ok = true;
      note = '阴影/蒙层（白名单）';
    } else if (lower.startsWith('rgb(')) {
      kind = 'rgb';
      note = '无 alpha 的 rgb 语义色，禁止';
    } else if (lower.startsWith('hsl')) {
      kind = 'hsl';
      note = 'hsl 语义色，禁止';
    } else {
      kind = 'hex';
      ok = HEX_WHITELIST.has(lower);
      note = ok ? '十六进制白名单' : '不在十六进制白名单';
    }
    const entry = { line, raw, kind, ok, note, context };
    found.push(entry);
    if (!ok) violations.push(entry);
  }

  const kindCount = found.reduce((acc, e) => ((acc[e.kind] = (acc[e.kind] || 0) + 1), acc), {});
  const evidence = [
    `${rel(cssPath)}: 共 ${found.length} 处颜色字面量（${Object.entries(kindCount).map(([k, v]) => `${k} ${v}`).join(' / ')}）；var(--dsw-alias-*) 直接引用 ${directAliasRefs} 处`,
    `十六进制白名单: ${[...HEX_WHITELIST].join(' / ')}；rgba(...) 与引用主题 token 的 color-mix(...) 放行`,
    violations.length
      ? `违规（非白名单色值）${violations.length} 处:\n` +
        violations.map((v) => `    panel.css:${v.line}  ${v.raw}   ← ${v.context}（${v.note}）`).join('\n')
      : '违规: 无 —— 语义色都走主题 token / 白名单',
  ].join('\n');
  return {
    status: violations.length ? 'FAIL' : 'PASS',
    evidence,
    extra: { total: found.length, directAliasRefs, violations, allowed: found.filter((e) => e.ok) },
  };
}

/** C14：注册 main + sidebar.panellist，main 内用 PcErrorBoundary 兜底。 */
async function checkC14() {
  const src = readFileSync(join(PROJECT_ROOT, 'client.js'), 'utf8');
  const problems = [];
  const evidence = [];

  // main slot
  const mainReg = /ctx\s*\.\s*slots\s*\.\s*register\s*\(\s*\{\s*name\s*:\s*['"]main['"]/g;
  const mainMatches = [...src.matchAll(mainReg)];
  // 注意：inject 的参数是字符串字面量，必须在原始源码里匹配（code 已去掉字符串/注释）
  const mainInject = /ctx\s*\.\s*slots\s*\.\s*inject\s*\(\s*['"]main['"]/.test(src);
  const hasPanelKey = /name\s*:\s*['"]main['"][^}]*\bkey\s*:\s*PC_PANEL_ID/.test(src) ||
    /name\s*:\s*['"]main['"][^}]*\bkey\s*:\s*['"]pinterest-collect['"]/.test(src);
  evidence.push(`main slot 注册: ${mainMatches.length ? mainMatches.map((m) => '行' + lineOf(src, m.index)).join(',') : '未找到'}，inject('main')=${mainInject}，key=PC_PANEL_ID=${hasPanelKey}`);
  if (!mainMatches.length) problems.push('未找到 slots.register({ name: "main" })');
  if (!mainInject) problems.push("未找到 slots.inject('main', ...)");
  if (!hasPanelKey) problems.push("main 注册未使用 key=PC_PANEL_ID(pinterest-collect)");

  // sidebar.panellist slot
  const sideMatches = [...src.matchAll(/ctx\s*\.\s*slots\s*\.\s*register\s*\(\s*\{\s*name\s*:\s*['"]sidebar\.panellist['"]/g)];
  const sideInject = /ctx\s*\.\s*slots\s*\.\s*inject\s*\(\s*['"]sidebar\.panellist['"]/.test(src);
  const hasSideId = /name\s*:\s*['"]sidebar\.panellist['"][^}]*\bid\s*:\s*PC_PANEL_ID/.test(src) ||
    /name\s*:\s*['"]sidebar\.panellist['"][^}]*\bid\s*:\s*['"]pinterest-collect['"]/.test(src);
  evidence.push(`sidebar.panellist 注册: ${sideMatches.length ? sideMatches.map((m) => '行' + lineOf(src, m.index)).join(',') : '未找到'}，inject=${sideInject}，id=PC_PANEL_ID=${hasSideId}`);
  if (!sideMatches.length) problems.push('未找到 slots.register({ name: "sidebar.panellist" })');
  if (!sideInject) problems.push("未找到 slots.inject('sidebar.panellist', ...)");
  if (!hasSideId) problems.push('sidebar.panellist 注册未使用 id=PC_PANEL_ID(pinterest-collect)');
  // label
  // label 可以是字符串字面量,也可以是 thunk(() => pcT('Pinterest 收藏')),后者在语言切换时更友好
  const labelOk = /name\s*:\s*['"]sidebar\.panellist['"][\s\S]{0,220}?label\s*:\s*(?:['"][^'"]+['"]|\(\)\s*=>)/.test(src);
  if (!labelOk) problems.push('sidebar.panellist 注册缺少 label');

  // PcErrorBoundary
  const boundaryDecl = /class\s+PcErrorBoundary\s+extends\s+React\s*\.\s*Component/.test(src);
  const boundaryUse = /h\s*\(\s*PcErrorBoundary\b/.test(src);
  evidence.push(`PcErrorBoundary: class 声明=${boundaryDecl}（行${boundaryDecl ? lineOf(src, src.indexOf('class PcErrorBoundary')) : '-'}），main 渲染中使用=${boundaryUse}`);
  if (!boundaryDecl) problems.push('缺少 PcErrorBoundary class');
  if (!boundaryUse) problems.push('main 没有用 PcErrorBoundary 包裹');

  return {
    status: problems.length ? 'FAIL' : 'PASS',
    evidence: evidence.join('\n') + (problems.length ? `\n  问题: ${problems.join(' ; ')}` : ''),
    extra: { problems },
  };
}

/**
 * C15：v1.1 账号/登录/推荐 UI 静态标记。
 *  - 不再有 /topics 遗留：PC_TOPIC_FALLBACK、/topics 请求、topic chip 类名、'推荐分类' 字符串字面量；
 *    `pc-topic-row` 这个 CSS 类仍被左侧收藏夹 chips 复用，**不算遗留**。
 *  - PcLoginDialog 存在且被渲染。
 *  - panel.css 含 .pc-account-bar / .pc-login-card。
 *  - client.js 调用 pcFetch('/account') 与 /feed（直接字面量或用 pathname 变量调用均算）。
 */
async function checkC15() {
  const clientSrc = readFileSync(join(PROJECT_ROOT, 'client.js'), 'utf8');
  const cssSrc = readFileSync(join(PROJECT_ROOT, 'src/client/panel.css'), 'utf8');
  const problems = [];
  const evidence = [];

  // 1) /topics 遗留
  const topicFallback = clientSrc.includes('PC_TOPIC_FALLBACK');
  const topicEndpoint = clientSrc.includes("'/topics") || clientSrc.includes('"/topics') || clientSrc.includes('/pinterest-api/topics');
  const legacyTopicClasses = [...new Set([...clientSrc.matchAll(/pc-topic-(?!row\b)[\w-]+/g)].map((m) => m[0]))];
  // '推荐分类' 只允许出现在注释里（说明已移除）；出现在任何字符串/模板字面量里都算 UI 文案遗留
  const topicLabelInStrings = stringLiteralContents(clientSrc).some((s) => s.includes('推荐分类'));
  const topicRowUses = (clientSrc.match(/pc-topic-row\b/g) || []).length;
  const topicRowForCollection = /pc-topic-row pc-collection-chips/.test(clientSrc);
  evidence.push(
    `/topics 遗留: PC_TOPIC_FALLBACK=${topicFallback}，/topics 请求=${topicEndpoint}，` +
      `legacy topic 类名=${legacyTopicClasses.length ? legacyTopicClasses.join(',') : '无'}，'推荐分类' 出现在字符串字面量=${topicLabelInStrings}`,
  );
  evidence.push(`pc-topic-row：出现 ${topicRowUses} 次（CSS + 左侧收藏夹 chips，复用允许），用于收藏夹 chips=${topicRowForCollection}`);
  if (topicFallback) problems.push('client.js 仍有 PC_TOPIC_FALLBACK');
  if (topicEndpoint) problems.push('client.js 仍有 /topics 请求');
  if (legacyTopicClasses.length) problems.push(`client.js 仍有 topic chip 遗留类名: ${legacyTopicClasses.join(',')}`);
  if (topicLabelInStrings) problems.push("client.js 仍有 '推荐分类' 字符串字面量（topic chip 文案遗留）");

  // 2) PcLoginDialog
  const loginDialogDecl = /function\s+PcLoginDialog\s*\(/.test(clientSrc);
  const loginDialogUse = /h\(\s*PcLoginDialog\b/.test(clientSrc);
  evidence.push(`PcLoginDialog: 声明=${loginDialogDecl}（行${loginDialogDecl ? lineOf(clientSrc, clientSrc.indexOf('function PcLoginDialog')) : '-'}），渲染使用=${loginDialogUse}`);
  if (!loginDialogDecl) problems.push('缺少 PcLoginDialog 组件');
  if (!loginDialogUse) problems.push('PcLoginDialog 没有被渲染');

  // 3) panel.css 账号栏 / 登录卡片
  const accountBarCss = /\.pc-account-bar\s*(?:,|\{)/.test(cssSrc);
  const loginCardCss = /\.pc-login-card\s*(?:,|\{)/.test(cssSrc);
  evidence.push(`panel.css: .pc-account-bar=${accountBarCss}，.pc-login-card=${loginCardCss}`);
  if (!accountBarCss) problems.push('panel.css 缺少 .pc-account-bar');
  if (!loginCardCss) problems.push('panel.css 缺少 .pc-login-card');

  // 4) 账号/推荐请求
  const accountCallIdx = clientSrc.search(/pcFetch\(\s*['"]\/account['"]\s*\)/);
  const feedDirectIdx = clientSrc.search(/pcFetch\(\s*['"]\/feed(?=[?'"`])/);
  const feedPathIdx = clientSrc.search(/['"]\/feed\?limit=24/);
  const feedViaPath = feedPathIdx !== -1 && /pcFetch\(\s*pathname\s*\)/.test(clientSrc);
  const accountCall = accountCallIdx !== -1;
  const feedCall = feedDirectIdx !== -1 || feedViaPath;
  evidence.push(
    `pcFetch('/account') 直接调用: ${accountCall ? '是 @ client.js:' + lineOf(clientSrc, accountCallIdx) : '否'}`,
  );
  evidence.push(
    `pcFetch('/feed…') 调用: ${
      feedDirectIdx !== -1
        ? '是（直接字面量 @ client.js:' + lineOf(clientSrc, feedDirectIdx) + '）'
        : feedViaPath
          ? "是（等价形式：'/feed?limit=24' 字面量 @ client.js:" + lineOf(clientSrc, feedPathIdx) + ' 经 pcFetch(pathname) 发出）'
          : '否'
    }`,
  );
  if (!accountCall) problems.push("client.js 没有 pcFetch('/account') 调用");
  if (!feedCall) problems.push("client.js 没有调用 /feed（pcFetch('/feed…') 或等价 pathname 形式）");

  return {
    status: problems.length ? 'FAIL' : 'PASS',
    evidence: evidence.join('\n') + (problems.length ? `\n  问题: ${problems.join(' ; ')}` : ''),
    extra: { topicFallback, topicEndpoint, legacyTopicClasses, loginDialogDecl, loginDialogUse, accountBarCss, loginCardCss, accountCall, feedCall },
  };
}

// ---------------------------------------------------------------- 主流程 + 报表

function displayWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += /[\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]/.test(ch) ? 2 : 1;
  return w;
}
function pad(s, width) {
  return String(s) + ' '.repeat(Math.max(0, width - displayWidth(s)));
}

function printTable() {
  const rows = results.map((r) => [r.id, r.title, r.status, String(r.evidence).split('\n')[0].slice(0, 70)]);
  const headers = ['#', '检查项', '结果', '证据摘要'];
  const widths = headers.map((h, i) => Math.max(displayWidth(h), ...rows.map((r) => displayWidth(r[i]))));
  const line = (cells) => cells.map((c, i) => pad(c, widths[i])).join('  ');
  console.log('\n' + '='.repeat(widths.reduce((a, b) => a + b + 2, 0)));
  console.log(line(headers));
  console.log('-'.repeat(widths.reduce((a, b) => a + b + 2, 0)));
  for (const row of rows) console.log(line(row));
  console.log('='.repeat(widths.reduce((a, b) => a + b + 2, 0)));
}

async function main() {
  console.log(`pinterest-collect 验证（插件 v1.1）· ${new Date().toISOString()}`);
  console.log(`项目: ${PROJECT_ROOT}`);
  console.log(`Profile: ${PROFILE_DIR}`);
  console.log(`Host: ${BASE}`);
  console.log(`数据目录: ${DATA_DIR}`);
  const sessionAtStart = sessionInfo();
  console.log(`session.json（测前快照，只 stat 大小/权限，不读内容）: ${sessionLabel(sessionAtStart)}`);
  console.log('');

  console.log('— A. 安装与清单 —');
  await check('A1', 'profile 安装：bundles 含 pinterest-collect + 依赖可用(本地链接或 GitHub 插件包)', checkA1);
  await check('A2', '包清单：exports . / ./client / ./locale/*.json / ./icon + dsh.bundle.patch + platform=web', checkA2);
  await check('A3', 'locale/en.json、zh.json 的 meta.title/description + icon.svg 基础校验', checkA3);

  console.log('\n— B. Host 侧（真实 HTTP，无 mock；带超时）—');
  await check('B4', 'v1.1 接口：GET /topics 已移除（404），GET /collection 结构符合 CONTRACT', checkB4);
  await check('B5', '临时收藏 → 查询可见 → unsave 还原（B5 必须还原，不留测试数据）', checkB5);
  await check('B6', '未知路由 404 JSON；垃圾 body 400 JSON 且服务不崩', checkB6);
  await check('B7', 'GET /health（version semver / authReady 布尔 / account 对象）+ GET /account 字段类型', checkB7);
  await check('B8', 'GET /feed 未登录：authReady=false → 503 中文；authReady=true → 401', checkB8);
  await check('B9', '登录窗口入口：POST /account/login/start（无 Chrome→409+中文；有 Chrome→SKIP，绝不弹窗）', checkB9);
  await check('B10', '凭据与退出：cookies 垃圾串→400/503（不得 500）+ logout→200/connected:false + 不留下 session.json', checkB10);

  console.log('\n— C. 客户端静态检查（读 client.js / panel.css，不执行 UI）—');
  await check('C11', 'node --check client.js + parts / 内嵌 CSS 与构建产物同步', checkC11);
  await check('C12', '只 require("react")；无 document.body 写入 / dangerouslySetInnerHTML / eval', checkC12);
  await check('C13', 'panel.css 颜色合规：白名单 #b32c48/#9c223d/#fff/#101014 + rgba + 引用主题 token 的 color-mix', checkC13);
  await check('C14', '注册 main + sidebar.panellist，main 内用 PcErrorBoundary 兜底', checkC14);
  await check('C15', 'v1.1 UI 静态：无 /topics 遗留；PcLoginDialog / 账号栏 / 登录卡片 / /account+/feed 请求', checkC15);

  printTable();

  const counts = results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {});
  const fails = results.filter((r) => r.status === 'FAIL');
  console.log(`\n结果: ${results.length} 项 → PASS ${counts.PASS || 0} · FAIL ${counts.FAIL || 0} · SKIP ${counts.SKIP || 0} · 用时 ${elapsed()}`);
  console.log(
    `运行时: version=${JSON.stringify(runtime.version)} authReady=${JSON.stringify(runtime.authReady)} ` +
      `connected=${JSON.stringify(runtime.connected)} chromeAvailable=${JSON.stringify(runtime.chromeAvailable)} chromeName=${JSON.stringify(runtime.chromeName)}`,
  );

  if (DEGRADED.length) {
    console.log('\n降级分支（登录/推荐模块就绪后需重跑）:');
    for (const d of DEGRADED) console.log(`  • ${d.id} ${d.reason}`);
  } else if (runtime.authReady === true) {
    console.log('\n降级分支: 无（本次 authReady=true，账号/推荐接口走正常分支）');
  } else {
    console.log(`\n降级分支: 无（authReady=${JSON.stringify(runtime.authReady)}，Host 未响应或未返回 authReady，账号/推荐接口未能按正常分支验证）`);
  }

  const sessionAtEnd = sessionInfo();
  const sessionSafe = sessionAtStart.exists
    ? sessionAtEnd.exists && sessionAtStart.size === sessionAtEnd.size
    : !sessionAtEnd.exists;
  console.log(`\n数据安全: session.json 测前=${sessionLabel(sessionAtStart)} 测后=${sessionLabel(sessionAtEnd)} → ${sessionSafe ? '安全（测试未写入/未删除）' : '⚠ 状态发生变化，请人工检查'}`);
  if (sessionAtStart.exists) console.log('  说明: 测前已存在 session.json，登录/凭据相关破坏性测试已跳过。');

  if (fails.length) {
    console.log('\n失败项:');
    for (const f of fails) console.log(`  ✖ ${f.id} ${f.title}`);
    console.log('\n注意：B5 若失败，请检查 /pinterest-api/collection 是否残留 verify-check-* 测试数据。');
    console.log('       C11 若失败，先运行 node build-client.mjs 再重跑本脚本。');
  } else {
    console.log('\n✅ 全部通过');
  }

  if (JSON_OUT) {
    const outPath = resolve(JSON_OUT);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          projectRoot: PROJECT_ROOT,
          profileDir: PROFILE_DIR,
          base: BASE,
          dataDir: DATA_DIR,
          generatedAt: new Date().toISOString(),
          runtime,
          session: {
            path: SESSION_PATH,
            before: sessionAtStart,
            after: sessionAtEnd,
            safe: sessionSafe,
          },
          degraded: DEGRADED,
          results,
          counts,
        },
        null,
        2,
      ),
    );
    console.log(`机器可读报告: ${outPath}`);
  }

  process.exitCode = fails.length || !sessionSafe ? 1 : 0;
}

main().catch((e) => {
  console.error('验证脚本自身异常:', e);
  process.exitCode = 1;
});
