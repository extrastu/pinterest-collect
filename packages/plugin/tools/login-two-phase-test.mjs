#!/usr/bin/env node
/**
 * 两段式交互登录的离屏验证(不会弹出可见窗口):
 *  A. 阶段 A 启动的 Chrome **不带** --remote-debugging-port(这是 Google 拒绝登录的根因);
 *  B. 点「继续」/退出后能自动进入阶段 B,读到 profile 里的 cookie;
 *  C. 取消、超时都能收尾,且不留下 Chrome 进程。
 *
 * 用 headlessPhaseA 代替真人登录:没人真的登录,所以最终状态应是 closed(读不到 _auth=1),
 * 但 cookie 列表里应出现 csrftoken,证明阶段 B 的读取链路真的工作。
 */
import { execFileSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findChrome, startLogin, startLoginInteractive } from '../lib/browser-login.mjs'

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const workDir = path.join(root, 'tools', '.tmp-two-phase')

let passed = 0
let failed = 0
function check(name, ok, detail) {
  if (ok) {
    passed += 1
    console.log(`  PASS  ${name}${detail ? ` · ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail ? ` · ${detail}` : ''}`)
  }
}

function chromeProcessesFor(dir) {
  try {
    const out = execFileSync('ps', ['axww', '-o', 'pid=,args='], { encoding: 'utf8', timeout: 5000 })
    return out
      .split('\n')
      .filter(line => line.includes(dir))
      .map(line => line.trim())
  } catch {
    return []
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

await fs.rm(workDir, { recursive: true, force: true })
await fs.mkdir(workDir, { recursive: true })

try {
  const chrome = findChrome()
  console.log(`Chrome: ${chrome ? `${chrome.name} (${chrome.path})` : '未找到'}`)
  check('能找到 Chrome', Boolean(chrome))
  if (!chrome) throw new Error('没有 Chrome,无法继续')

  console.log('\n[A] 阶段 A 不暴露调试端口')
  const profileA = path.join(workDir, 'profile-a')
  let control = null
  let argsSeenDuringPhaseA = []
  const interactive = startLoginInteractive({
    profileDir: profileA,
    headlessPhaseA: true,
    timeoutMs: 25000,
    onProgress: p => {
      if (p && p.phase === 'waiting-login') console.log(`       progress: ${p.phase} · ${p.message.slice(0, 48)}…`)
    },
    onControl: c => {
      control = c
    }
  })
  // 等阶段 A 起来,抓它的命令行参数
  for (let attempt = 0; attempt < 30 && !argsSeenDuringPhaseA.length; attempt += 1) {
    await sleep(400)
    argsSeenDuringPhaseA = chromeProcessesFor(profileA)
  }
  check('阶段 A 的 Chrome 进程已启动', argsSeenDuringPhaseA.length > 0, `找到 ${argsSeenDuringPhaseA.length} 个进程`)
  const debugInPhaseA = argsSeenDuringPhaseA.filter(line => line.includes('--remote-debugging-port'))
  check('阶段 A 命令行里没有 --remote-debugging-port(Google 不再判不安全)', debugInPhaseA.length === 0, debugInPhaseA[0]?.slice(0, 120) || '无')
  const automationInPhaseA = argsSeenDuringPhaseA.filter(line => line.includes('--enable-automation'))
  check('阶段 A 命令行里没有 --enable-automation', automationInPhaseA.length === 0)

  check('拿到了控制句柄(continueNow)', Boolean(control && typeof control.continueNow === 'function'))
  await sleep(2500)
  const accepted = control ? control.continueNow() : false
  check('continueNow() 被接受', accepted === true)

  const resultA = await interactive
  check('阶段 A 在 headless 下没登录,最终应是 closed', resultA.status === 'closed', `status=${resultA.status}`)
  check('阶段 B 真的读到了 cookie(csrftoken)', resultA.cookies.some(c => c.name === 'csrftoken'), `cookies=${resultA.cookies.map(c => c.name).join(',') || '空'}`)
  await sleep(600)
  check('结束后没有残留 Chrome 进程', chromeProcessesFor(profileA).length === 0)

  console.log('\n[B] 阶段 B 独立读取已存在的 profile')
  const profileB = path.join(workDir, 'profile-b')
  // 先制造一个有 cookie 的 profile(用现有 CDP 流程跑一次,未登录会超时,但会写 cookie)
  await startLogin({ profileDir: profileB, timeoutMs: 9000, headless: true })
  await sleep(500)
  const startedAt = Date.now()
  const probe = await startLogin({ profileDir: profileB, loginUrl: null, headless: true, timeoutMs: 6000 })
  const elapsed = Date.now() - startedAt
  check('阶段 B 直接从 profile 读到 cookie', probe.cookies.some(c => c.name === 'csrftoken'), `cookies=${probe.cookies.map(c => c.name).join(',') || '空'}`)
  check('阶段 B 读 cookie 很快(<8s)', elapsed < 8000, `${elapsed}ms`)
  await sleep(600)
  check('阶段 B 结束后没有残留 Chrome 进程', chromeProcessesFor(profileB).length === 0)

  console.log('\n[C] 取消与超时收尾')
  const profileC = path.join(workDir, 'profile-c')
  const controller = new AbortController()
  const cancelled = startLoginInteractive({
    profileDir: profileC,
    headlessPhaseA: true,
    timeoutMs: 20000,
    signal: controller.signal
  })
  await sleep(2500)
  controller.abort()
  const resultC = await cancelled
  check('取消后返回 closed', resultC.status === 'closed', `status=${resultC.status}`)
  await sleep(600)
  check('取消后没有残留 Chrome 进程', chromeProcessesFor(profileC).length === 0)

  const profileD = path.join(workDir, 'profile-d')
  const timedOut = await startLoginInteractive({
    profileDir: profileD,
    headlessPhaseA: true,
    timeoutMs: 4000
  })
  check('超时后返回 timeout', timedOut.status === 'timeout', `status=${timedOut.status}`)
  await sleep(600)
  check('超时后没有残留 Chrome 进程', chromeProcessesFor(profileD).length === 0)
} finally {
  await fs.rm(workDir, { recursive: true, force: true })
}

console.log(`\n结果: ${passed} 通过 / ${failed} 失败`)
process.exit(failed ? 1 : 0)
