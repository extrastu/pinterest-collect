#!/usr/bin/env node
/**
 * Host 侧真实联网自测：node tools/host-fetch-test.mjs
 *
 * 覆盖：
 *  1) search("cozy living room") 连续两页，各打印前 3 个 pin 的 id/title/image，并对图片做 HEAD 可达性检查（允许 200/206）
 *  2) 断言：Pin 字段齐全、每页 pin 数 > 0、第二页与第一页 id 不重复、第二页确实拿到新书签
 *  3) related 一次（用第一页首个 pin 的 id + title），断言非空且不含自身
 *  4) resolveUrl 三种链接：pin / board / profile（外加 search 与 pin.it 降级观察）
 *  5) 错误路径：空 query、limit=0 → 明确抛错（中文 message + EINVAL）
 *  6) normalizePin 对缺字段输入的安全默认值
 *  7) 登录态新增接口（不触碰真实账号，全部假值）：未登录 feed() 立即抛 EAUTH、probe() 返回
 *     loggedIn=false；importCookies/exportCookies/clearCookies 的写入与字段完整性；
 *     假 cookie（_auth=0）下 probe 仍为 false；clearCookies 后 search 仍能工作。
 *
 * 退出码：全部断言通过 0，否则 1。
 */

import { createPinterestClient, normalizePin, PinterestError } from '../lib/pinterest.mjs';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const QUERY = 'cozy living room';
const IMAGE_TIMEOUT_MS = 10000;

let passed = 0;
const failures = [];
const t0 = Date.now();

function ok(cond, label) {
  if (cond) {
    passed += 1;
  } else {
    failures.push(label);
    console.log(`  ✗ 断言失败: ${label}`);
  }
  return Boolean(cond);
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function imageHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return '?';
  }
}

function ms(start) {
  return `${Date.now() - start}ms`;
}

function short(value, max = 60) {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** CONTRACT.md 的 Pin 字段完整性检查 */
function checkPin(pin, label) {
  const checks = [
    [typeof pin.id === 'string' && pin.id.length > 0, `${label}: id 非空字符串`],
    [typeof pin.title === 'string', `${label}: title 是字符串`],
    [typeof pin.description === 'string', `${label}: description 是字符串`],
    [isHttpUrl(pin.image), `${label}: image 是 http(s) URL`],
    [isHttpUrl(pin.imageLarge), `${label}: imageLarge 是 http(s) URL`],
    [typeof pin.width === 'number' && pin.width >= 0, `${label}: width 是数字`],
    [typeof pin.height === 'number' && pin.height >= 0, `${label}: height 是数字`],
    [typeof pin.dominantColor === 'string', `${label}: dominantColor 是字符串`],
    [/^https:\/\/www\.pinterest\.com\/pin\/[^/]+\/$/.test(pin.pinUrl), `${label}: pinUrl 形如 https://www.pinterest.com/pin/<id>/`],
    [typeof pin.sourceUrl === 'string', `${label}: sourceUrl 是字符串`],
    [typeof pin.siteName === 'string', `${label}: siteName 是字符串`],
    [pin.pinner && typeof pin.pinner.name === 'string' && typeof pin.pinner.username === 'string', `${label}: pinner.{name,username}`],
    [pin.board && typeof pin.board.name === 'string' && typeof pin.board.url === 'string', `${label}: board.{name,url}`],
    [typeof pin.isVideo === 'boolean', `${label}: isVideo 是布尔`],
  ];
  for (const [cond, msg] of checks) ok(cond, msg);
  // 图片优先 474x / imageLarge 优先 736x 或 originals（Pinterest 命名约定）
  ok(/\/474x\//.test(pin.image), `${label}: image 命中 474x 尺寸`);
  ok(/\/736x\/|\/originals\//.test(pin.imageLarge), `${label}: imageLarge 命中 736x/originals`);
}

/** HEAD 图片，允许 200/206 */
async function headImage(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
    });
    return { status: res.status, reachable: res.status === 200 || res.status === 206 };
  } catch (err) {
    return { status: 0, reachable: false, error: err?.message || String(err) };
  }
}

async function headImages(pins, label) {
  let reachable = 0;
  for (const [index, pin] of pins.entries()) {
    const head = await headImage(pin.image);
    if (head.reachable) reachable += 1;
    ok(head.reachable, `${label} #${index + 1} 图片 HEAD 可达（${head.status || head.error}）`);
    console.log(
      `    #${index + 1} id=${short(pin.id, 22)} | title="${short(pin.title, 46)}" | img=${imageHost(pin.image)}${head.reachable ? '' : ' ✗'}`
    );
  }
  return { reachable, total: pins.length };
}

async function expectReject(fn, label, expectedCode = 'EINVAL') {
  try {
    await fn();
    failures.push(`${label}: 未抛错`);
    console.log(`  ✗ ${label}: 期望抛错但成功了`);
    return null;
  } catch (err) {
    const isPinterest = err instanceof PinterestError;
    const hasChinese = /[\u4e00-\u9fa5]/.test(err?.message || '');
    ok(isPinterest, `${label}: 抛 PinterestError（实际 ${err?.name}）`);
    ok(expectedCode ? err?.code === expectedCode : true, `${label}: code=${expectedCode}（实际 ${err?.code}）`);
    ok(hasChinese, `${label}: message 为中文`);
    console.log(`    ${label} → ${err?.name} code=${err?.code} status=${err?.status} "${err?.message}"`);
    return err;
  }
}

function section(title) {
  console.log(`\n── ${title} ─────────────────────────────────────────`);
}

async function main() {
  console.log('=== Pinterest 抓取客户端真实联网自测 ===');
  console.log(`Node ${process.version} | node: ${process.execPath}`);
  console.log(`query="${QUERY}" | timeoutMs=12000（默认）`);

  const client = createPinterestClient();

  // 0) health：顺便完成 cookie 引导
  section('health / cookie 引导');
  const healthStart = Date.now();
  const health = await client.health();
  console.log(`  ready=${health.ready} cookieAgeMs=${health.cookieAgeMs} (${ms(healthStart)})${health.error ? ` error=${health.error}` : ''}`);
  ok(health.ready === true, 'health.ready 为 true');
  ok(typeof health.cookieAgeMs === 'number' && health.cookieAgeMs >= 0, 'health.cookieAgeMs 是非负数字');

  // 1) 第一页
  section(`search 第 1 页`);
  const s1Start = Date.now();
  const page1 = await client.search({ query: QUERY, limit: 24 });
  const d1 = Date.now() - s1Start;
  console.log(`  pins=${page1.pins.length} bookmark=${page1.bookmark ? 'yes' : 'null'} query="${page1.query}" (${d1})`);
  ok(Array.isArray(page1.pins), 'page1.pins 是数组');
  ok(page1.pins.length > 0, 'page1 pins 数 > 0');
  ok(page1.query === QUERY, 'page1.query 回显查询词');
  ok(typeof page1.bookmark === 'string' && page1.bookmark.length > 0, 'page1.bookmark 是可翻页字符串');
  const page1Ids = new Set(page1.pins.map((p) => p.id));
  ok(page1Ids.size === page1.pins.length, 'page1 内部 pin id 无重复');
  for (const [i, pin] of page1.pins.slice(0, 3).entries()) checkPin(pin, `page1 #${i + 1}`);
  console.log('  前 3 个 pin + 图片 HEAD：');
  const head1 = await headImages(page1.pins.slice(0, 3), 'page1');

  // 2) 第二页（传第一页 bookmark）
  section('search 第 2 页（分页）');
  const s2Start = Date.now();
  const page2 = await client.search({ query: QUERY, bookmark: page1.bookmark, limit: 24 });
  const d2 = Date.now() - s2Start;
  console.log(`  pins=${page2.pins.length} bookmark=${page2.bookmark ? 'yes' : 'null'} (${d2})`);
  ok(page2.pins.length > 0, 'page2 pins 数 > 0');
  const page2Ids = page2.pins.map((p) => p.id);
  const overlap = page2Ids.filter((id) => page1Ids.has(id));
  console.log(`  与第 1 页重复 id: ${overlap.length}`);
  ok(overlap.length === 0, '第二页与第一页 id 不重复');
  ok(page2.bookmark !== page1.bookmark, '第二页 bookmark 与第一页不同（翻页生效）');
  for (const [i, pin] of page2.pins.slice(0, 3).entries()) checkPin(pin, `page2 #${i + 1}`);
  console.log('  前 3 个 pin + 图片 HEAD：');
  const head2 = await headImages(page2.pins.slice(0, 3), 'page2');

  // 3) related（title 可用时的正常路径；id-only 用缓存回退）
  section('related');
  const seed = page1.pins[0];
  const relStart = Date.now();
  const related = await client.related({ id: seed.id, title: seed.title, limit: 24 });
  const dRel = Date.now() - relStart;
  console.log(`  seed id=${short(seed.id, 22)} title="${short(seed.title, 40)}"`);
  console.log(`  pins=${related.pins.length} bookmark=${related.bookmark ? 'yes' : 'null'} (${dRel})`);
  ok(related.pins.length > 0, 'related pins 数 > 0');
  ok(!related.pins.some((p) => p.id === seed.id), 'related 结果已剔除自身');
  ok(new Set(related.pins.map((p) => p.id)).size === related.pins.length, 'related 结果 id 无重复');
  for (const [i, pin] of related.pins.slice(0, 3).entries()) checkPin(pin, `related #${i + 1}`);
  const relCached = await client.related({ id: seed.id, limit: 6 });
  console.log(`  related({id}) 仅凭缓存标题回退: pins=${relCached.pins.length}`);
  ok(relCached.pins.length > 0, 'related({id}) 借助缓存标题回退成功');

  // 4) resolveUrl 三种链接
  section('resolveUrl');
  const pinLink = seed.pinUrl;
  const boardLink = seed.board.url || 'https://www.pinterest.com/iyundt840/living-rooms/';
  const username = seed.pinner.username || 'pinterest';
  const profileLink = `https://www.pinterest.com/${username}/`;
  const resolveStart = Date.now();
  const rPin = await client.resolveUrl(pinLink);
  const rBoard = await client.resolveUrl(boardLink);
  const rProfile = await client.resolveUrl(profileLink);
  const rSearch = await client.resolveUrl('https://www.pinterest.com/search/pins/?q=cozy%20living%20room');
  const rShort = await client.resolveUrl('https://pin.it/6nQwPzY');
  const rUnknown = await client.resolveUrl('https://example.com/foo/bar');
  const dResolve = Date.now() - resolveStart;
  console.log(`  ${short(pinLink, 70)} → ${rPin.kind} ${short(rPin.value, 50)}`);
  console.log(`  ${short(boardLink, 70)} → ${rBoard.kind} ${short(rBoard.value, 50)}`);
  console.log(`  ${short(profileLink, 70)} → ${rProfile.kind} ${short(rProfile.value, 50)}`);
  console.log(`  search 链接 → ${rSearch.kind} "${rSearch.value}"`);
  console.log(`  pin.it 短链 → ${rShort.kind}（无有效短码时降级 unknown，属预期）`);
  console.log(`  站外链接 → ${rUnknown.kind}（${short(rUnknown.value, 60)}）`);
  console.log(`  五类解析总耗时 ${dResolve}`);
  ok(rPin.kind === 'pin' && rPin.value === seed.id, 'pin 链接解析出 pin id');
  ok(rBoard.kind === 'board' && rBoard.value.startsWith('https://www.pinterest.com/'), 'board 链接解析出规范化 board URL');
  ok(rProfile.kind === 'profile' && rProfile.value === `https://www.pinterest.com/${username}/`, 'profile 链接解析出规范化 profile URL');
  ok(rSearch.kind === 'search' && rSearch.value === 'cozy living room', 'search 链接解析出搜索词');
  ok(rUnknown.kind === 'unknown', '站外链接解析为 unknown');
  ok(['pin', 'board', 'profile', 'search', 'unknown'].includes(rShort.kind), 'pin.it 短链返回合法 kind');

  // 5) 错误路径
  section('错误路径');
  await expectReject(() => client.search({ query: '' }), 'search 空 query');
  await expectReject(() => client.search({ query: QUERY, limit: 0 }), 'search limit=0');
  await expectReject(() => client.search({ query: QUERY, limit: 'abc' }), 'search limit=abc');
  await expectReject(() => client.related({ id: 'e1_not_seen_in_this_session_0000', limit: 6 }), 'related 缺 title 且无缓存', 'EINVAL');

  // 6) normalizePin 安全默认值
  section('normalizePin 安全默认值');
  const empty = normalizePin(null);
  ok(empty.id === '' && empty.title === '' && empty.image === '', 'normalizePin(null) 返回空字符串默认值');
  ok(typeof empty.pinner.name === 'string' && typeof empty.board.name === 'string' && empty.isVideo === false, 'normalizePin(null) 嵌套对象安全');
  const sparse = normalizePin({ id: 42, images: { '474x': { url: 'https://i.pinimg.com/474x/a.jpg', width: 474, height: 592 } } });
  ok(sparse.id === '42', 'normalizePin 数字 id 转字符串');
  ok(sparse.image === 'https://i.pinimg.com/474x/a.jpg' && sparse.width === 474 && sparse.height === 592, 'normalizePin 474x 尺寸/宽高');
  ok(sparse.imageLarge === 'https://i.pinimg.com/474x/a.jpg', 'normalizePin 缺 736x 时 imageLarge 回退 image');

  // 7) 登录态新增接口：feed / probe / cookie 导入导出（全部使用假值，不写真实账号 cookie）
  section('登录态（feed / probe / cookie 导入导出，全部假值）');

  // 7.1 未登录：feed 必须快速抛 EAUTH（不联网），probe 返回 loggedIn=false
  const feedStart = Date.now();
  const feedErr = await expectReject(() => client.feed({ limit: 6 }), 'feed 未登录', 'EAUTH');
  const dFeedNoLogin = Date.now() - feedStart;
  console.log(`  feed() 未登录耗时 ${dFeedNoLogin}ms（应远小于一次网络请求）`);
  ok(feedErr?.message === '需要登录 Pinterest', `feed 未登录 message 精确为「需要登录 Pinterest」（实际 "${short(feedErr?.message, 40)}"）`);
  ok(dFeedNoLogin < 1000, `feed 未登录是本地快速失败（${dFeedNoLogin}ms < 1000ms）`);

  const probeNoLogin = await client.probe();
  console.log(`  probe() 未登录: ${JSON.stringify(probeNoLogin)}`);
  ok(probeNoLogin.loggedIn === false, 'probe() 未登录返回 loggedIn=false');
  ok(typeof probeNoLogin.message === 'string' && probeNoLogin.message.length > 0, 'probe() 未登录带中文提示 message');
  ok(probeNoLogin.endpoint === undefined, 'probe() 未登录不返回 endpoint');

  // 7.2 importCookies：字符串形式（假值），返回条数、导出字段完整
  // 前面 search 已经引导了匿名 cookie，importCookies 是「合并写入」，所以按并集算期望条数
  const beforeNames = new Set(client.exportCookies().map((cookie) => cookie.name));
  const expectedJarSize = new Set([...beforeNames, 'csrftoken', '_pinterest_sess', '_auth']).size;
  console.log(`  导入前匿名 cookie: ${[...beforeNames].join(', ')}（${beforeNames.size} 条）`);
  const importedString = client.importCookies('csrftoken=x; _pinterest_sess=y; _auth=0');
  console.log(`  importCookies("csrftoken=x; _pinterest_sess=y; _auth=0") → ${importedString} 条`);
  ok(importedString === 3, `importCookies 字符串写入 3 条（实际 ${importedString}）`);

  const exported = client.exportCookies();
  const exportedSample = exported.find((cookie) => cookie.name === '_pinterest_sess') || exported[0] || {};
  console.log(`  exportCookies() → ${exported.length} 条，样例 ${JSON.stringify(exportedSample)}`);
  ok(exported.length === expectedJarSize, `exportCookies 条数与匿名+导入并集一致（期望 ${expectedJarSize}，实际 ${exported.length}）`);
  ok(
    exported.every(
      (cookie) =>
        typeof cookie.name === 'string' &&
        typeof cookie.value === 'string' &&
        typeof cookie.domain === 'string' &&
        typeof cookie.path === 'string' &&
        typeof cookie.secure === 'boolean' &&
        typeof cookie.httpOnly === 'boolean' &&
        typeof cookie.expires === 'number'
    ),
    'exportCookies 每条都含 name/value/domain/path/secure/httpOnly/expires'
  );
  ok(exported.every((cookie) => typeof cookie.domain === 'string' && cookie.domain.replace(/^\./, '').endsWith('pinterest.com')), 'exportCookies 的 domain 全部属于 pinterest.com');
  ok(exported.find((cookie) => cookie.name === '_auth')?.value === '0', '导入的 _auth=0 已写入 jar');

  // 7.3 假 cookie（_auth=0）不是登录态：probe 仍 false，feed 仍 EAUTH
  const probeFake = await client.probe();
  console.log(`  probe() 假 cookie: ${JSON.stringify(probeFake)}`);
  ok(probeFake.loggedIn === false, 'importCookies 假值后 probe() 仍为 loggedIn=false（_auth=0 不算登录）');
  await expectReject(() => client.feed({ limit: 6 }), 'feed 假 cookie（_auth=0）', 'EAUTH');

  // 7.4 importCookies：CDP cookie 数组形式（假值）
  const importedArray = client.importCookies([
    { name: '_auth', value: '0', domain: '.pinterest.com', path: '/', secure: true, httpOnly: true, expires: -1 },
  ]);
  ok(importedArray === 1, `importCookies(数组) 写入 1 条（实际 ${importedArray}）`);
  ok(client.exportCookies().length === expectedJarSize, `数组导入覆盖同名 cookie，jar 仍是 ${expectedJarSize} 条`);

  // 7.5 clearCookies：清空 jar，之后 search 仍能工作（重新匿名引导）
  const cleared = client.clearCookies();
  console.log(`  clearCookies() → 清理 ${cleared} 条`);
  ok(cleared === expectedJarSize, `clearCookies 返回清理条数 ${expectedJarSize}（实际 ${cleared}）`);
  ok(client.exportCookies().length === 0, 'clearCookies 后 jar 为空');

  const s3Start = Date.now();
  const page3 = await client.search({ query: 'minimalist desk setup', limit: 6 });
  const d3 = Date.now() - s3Start;
  console.log(`  clearCookies 后 search: pins=${page3.pins.length} (${d3}ms)`);
  ok(page3.pins.length > 0, 'clearCookies 后 search 仍可用（未登录搜索没有被登录态逻辑破坏）');
  ok(client.exportCookies().some((cookie) => cookie.name === 'csrftoken' && cookie.value), 'search 后匿名 csrftoken 已重新播种');

  // 汇总
  const total = Date.now() - t0;
  const imgTotal = head1.total + head2.total;
  const imgOk = head1.reachable + head2.reachable;
  section('汇总');
  console.log(`搜索结果: 第1页 ${page1.pins.length} 个（${d1}）, 第2页 ${page2.pins.length} 个（${d2}）, 重复 ${overlap.length}`);
  console.log(`图片域名: ${[...new Set([...page1.pins, ...page2.pins].map((p) => imageHost(p.image)))].join(', ')}`);
  console.log(`图片 HEAD: ${imgOk}/${imgTotal} 可达（允许 200/206）`);
  console.log(`related: pins=${related.pins.length}（${dRel}）, 自身已剔除=${!related.pins.some((p) => p.id === seed.id)}`);
  console.log(`resolveUrl: ${rPin.kind}/${rBoard.kind}/${rProfile.kind}/${rSearch.kind}/${rUnknown.kind}`);
  console.log(`断言: ${passed} 通过, ${failures.length} 失败 | 总耗时 ${total}ms`);

  if (failures.length) {
    console.log(`\n=== 结果: FAIL ===`);
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n=== 结果: PASS ===');
}

main().catch((err) => {
  console.error('\n自测脚本异常终止：', err?.stack || err);
  process.exitCode = 1;
});
