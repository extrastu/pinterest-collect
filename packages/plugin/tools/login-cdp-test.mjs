#!/usr/bin/env node
/**
 * Pinterest 登录（Chrome CDP）真实自测：node tools/login-cdp-test.mjs
 *
 * 用 headless Chrome 真跑，不打扰桌面。覆盖：
 *  a) findChrome() 能找到系统 Chrome（macOS 期望 /Applications/Google Chrome.app/...）
 *  b) startLogin(headless) 能启动 Chrome、经 CDP 连上、导航到 pinterest.com 并抓到 Cookie：
 *     csrftoken / _pinterest_sess 存在，_auth === '0'（未登录），onProgress 关键阶段齐全
 *  c) startLogin({timeoutMs:12000}) 未登录时按时返回 timeout，且结束后没有残留 Chrome 进程
 *  d) AbortSignal 取消（UI 上的「取消登录」）→ 返回 closed、快速收尾、无残留进程
 *  e) 汇总 PASS/FAIL 与各阶段耗时，退出码 0/1
 *
 * 只使用独立临时 profile 目录（os.tmpdir()），绝不使用用户日常 Chrome profile；
 * 全程打印的只有 cookie 名，不打印 cookie 值。
 */

import { execFileSync } from 'node:child_process';
import { existsSync, promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { findChrome, startLogin } from '../lib/browser-login.mjs';

let passed = 0;
const failures = [];
const t0 = Date.now();

function ok(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}`);
  }
  return Boolean(cond);
}

function section(title) {
  console.log(`\n── ${title} ─────────────────────────────────────────`);
}

function ms(start) {
  return `${Date.now() - start}ms`;
}

function short(value, max = 120) {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** 临时 profile 目录：带有可识别的固定前缀，方便残留进程检查与清理 */
function makeProfileDir(label) {
  return path.join(os.tmpdir(), `pinterest-login-test-${label}-${process.pid}`);
}

/** 删除自己创建的临时目录（先确认它确实在 tmpdir 且带固定前缀） */
async function cleanupProfileDir(dir) {
  const resolved = path.resolve(dir);
  const prefix = path.join(path.resolve(os.tmpdir()), 'pinterest-login-test-');
  if (!resolved.startsWith(prefix)) {
    console.log(`  ! 跳过删除非测试目录：${resolved}`);
    return;
  }
  await fsp.rm(resolved, { recursive: true, force: true }).catch(() => {});
}

/** 找与 profileDir 相关的存活进程（pgrep 不会匹配自己） */
function findChromeProcesses(profileDir) {
  try {
    const out = execFileSync('pgrep', ['-f', profileDir], { encoding: 'utf8' });
    return out.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch (error) {
    if (error && error.status === 1) return []; // 没有匹配进程
    return [];
  }
}

/** 等进程消失，最多 waitMs；返回最后一次看到的进程列表 */
async function waitNoProcess(profileDir, waitMs = 3000) {
  const deadline = Date.now() + waitMs;
  let left = findChromeProcesses(profileDir);
  while (left.length && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    left = findChromeProcesses(profileDir);
  }
  return left;
}

function cookieNames(cookies) {
  return (Array.isArray(cookies) ? cookies : []).map((cookie) => cookie.name).join(', ');
}

function findCookie(cookies, name) {
  return (Array.isArray(cookies) ? cookies : []).find((cookie) => cookie.name === name) || null;
}

async function main() {
  console.log('=== Pinterest 登录 Chrome CDP 自测（headless，不打扰桌面）===');
  console.log(`Node ${process.version} | platform=${process.platform} | tmp=${os.tmpdir()}`);

  // -------------------------------------------------------------------------
  section('a) findChrome()');
  const chrome = findChrome();
  console.log(`  Chrome: ${chrome ? `${chrome.name} → ${chrome.path}` : '未找到'}`);
  ok(Boolean(chrome), 'findChrome() 返回可用浏览器');
  if (chrome) {
    ok(existsSync(chrome.path), 'Chrome 可执行文件存在');
    if (process.platform === 'darwin') {
      ok(
        chrome.path === '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        'macOS 命中 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      );
    }
  }
  if (!chrome) {
    console.log('\n=== 结果: FAIL（没有 Chrome，无法继续 CDP 测试）===');
    process.exitCode = 1;
    return;
  }

  // -------------------------------------------------------------------------
  section('b) headless 启动 + CDP 抓 Cookie（未登录，期望 _auth=0）');
  const profileB = makeProfileDir('b');
  const phases = [];
  const bStart = Date.now();
  const bTimeoutMs = 9000;
  const b = await startLogin({
    profileDir: profileB,
    headless: true,
    timeoutMs: bTimeoutMs,
    onProgress: (progress) => {
      if (progress && progress.phase) phases.push(progress.phase);
    },
  });
  const bElapsed = Date.now() - bStart;
  const bNames = cookieNames(b.cookies);
  console.log(`  status=${b.status} | 耗时 ${bElapsed}ms | cookies(${b.cookies.length}): ${short(bNames, 160)}`);
  console.log(`  message="${short(b.message, 120)}"`);
  ok(b.status === 'timeout', `未登录时 9s 超时返回 status=timeout（实际 ${b.status}）`);
  ok(Array.isArray(b.cookies) && b.cookies.length > 0, `超时也返回最后一次 cookie 快照（${b.cookies.length} 条）`);
  ok(Boolean(findCookie(b.cookies, 'csrftoken')), 'cookie 含 csrftoken');
  ok(Boolean(findCookie(b.cookies, '_pinterest_sess')), 'cookie 含 _pinterest_sess');
  const bAuth = findCookie(b.cookies, '_auth');
  ok(Boolean(bAuth), 'cookie 含 _auth');
  ok(bAuth && bAuth.value === '0', `未登录时 _auth === '0'（实际 ${bAuth ? JSON.stringify(bAuth.value) : 'null'}）`);
  const sampleCookie = b.cookies.find((cookie) => cookie.name === '_pinterest_sess') || b.cookies[0];
  ok(
    Boolean(sampleCookie && sampleCookie.domain && sampleCookie.path && typeof sampleCookie.secure === 'boolean'),
    'cookie 字段完整（domain/path/secure）'
  );
  ok(b.cookies.every((cookie) => String(cookie.domain).replace(/^\./, '').endsWith('pinterest.com')), 'cookie 全部属于 pinterest.com 域');
  ok(phases.includes('launching'), 'onProgress 收到 launching');
  ok(phases.includes('waiting-login'), 'onProgress 收到 waiting-login');
  ok(phases.includes('closing'), 'onProgress 收到 closing');
  ok(bElapsed >= bTimeoutMs * 0.9 && bElapsed <= bTimeoutMs + 10000, `超时分支耗时合理（${bElapsed}ms，期望 ≈${bTimeoutMs}ms + 收尾）`);
  const bLeft = await waitNoProcess(profileB, 3000);
  ok(bLeft.length === 0, `b 结束后无残留 Chrome 进程（${bLeft.length ? bLeft.join(',') : '无'}）`);
  await cleanupProfileDir(profileB);
  console.log(`  b 阶段小计 ${ms(bStart)}`);

  // -------------------------------------------------------------------------
  section('c) 超时收尾 + 无残留进程（timeoutMs=12000）');
  const profileC = makeProfileDir('c');
  const cStart = Date.now();
  const cTimeoutMs = 12000;
  const c = await startLogin({ profileDir: profileC, headless: true, timeoutMs: cTimeoutMs });
  const cElapsed = Date.now() - cStart;
  console.log(`  status=${c.status} | 耗时 ${cElapsed}ms | cookies(${c.cookies.length}): ${short(cookieNames(c.cookies), 120)}`);
  ok(c.status === 'timeout', `按时返回 timeout（实际 ${c.status}）`);
  ok(cElapsed >= cTimeoutMs * 0.9 && cElapsed <= cTimeoutMs + 8000, `timeout 分支耗时落在 [${cTimeoutMs}ms, ${cTimeoutMs + 8000}ms]（实际 ${cElapsed}ms）`);
  const cLeft = await waitNoProcess(profileC, 5000);
  ok(cLeft.length === 0, `c 结束后无残留 Chrome 进程（${cLeft.length ? cLeft.join(',') : '无'}）`);
  // 进程残留时打印一次命令行，方便排查（不会包含 cookie）
  if (cLeft.length) {
    try {
      console.log('  残留进程：', execFileSync('ps', ['-o', 'pid=,command=', '-p', cLeft.join(',')], { encoding: 'utf8' }).trim());
    } catch {
      /* 进程已消失 */
    }
  }
  await cleanupProfileDir(profileC);

  // -------------------------------------------------------------------------
  section('d) 取消登录（AbortSignal）→ closed 且无残留进程');
  const profileD = makeProfileDir('d');
  const controller = new AbortController();
  const dStart = Date.now();
  const abortTimer = setTimeout(() => controller.abort(), 2500);
  const d = await startLogin({ profileDir: profileD, headless: true, timeoutMs: 60000, signal: controller.signal });
  clearTimeout(abortTimer);
  const dElapsed = Date.now() - dStart;
  console.log(`  status=${d.status} | 耗时 ${dElapsed}ms | message="${short(d.message, 80)}"`);
  ok(d.status === 'closed', `取消后返回 status=closed（实际 ${d.status}）`);
  ok(dElapsed < 15000, `取消后快速收尾（${dElapsed}ms < 15000ms）`);
  const dLeft = await waitNoProcess(profileD, 5000);
  ok(dLeft.length === 0, `d 取消后无残留 Chrome 进程（${dLeft.length ? dLeft.join(',') : '无'}）`);
  await cleanupProfileDir(profileD);

  // -------------------------------------------------------------------------
  section('汇总');
  const total = Date.now() - t0;
  console.log(`a) Chrome: ${chrome.name}（${chrome.path}）`);
  console.log(`b) headless 抓 cookie: status=${b.status}, cookies=${b.cookies.length}, _auth=${bAuth ? bAuth.value : 'null'}, 耗时 ${bElapsed}ms`);
  console.log(`c) 超时收尾: status=${c.status}, 耗时 ${cElapsed}ms, 残留进程=${cLeft.length}`);
  console.log(`d) 取消收尾: status=${d.status}, 耗时 ${dElapsed}ms, 残留进程=${dLeft.length}`);
  console.log(`断言: ${passed} 通过, ${failures.length} 失败 | 总耗时 ${total}ms`);

  if (failures.length) {
    console.log('\n=== 结果: FAIL ===');
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n=== 结果: PASS ===');
}

main().catch(async (error) => {
  console.error('\n自测脚本异常终止：', error?.stack || error);
  process.exitCode = 1;
});
