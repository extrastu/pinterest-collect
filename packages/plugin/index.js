/**
 * Pinterest 收藏 · Host half
 *
 * 两类能力:
 *  1. /pinterest-api/*:浏览器侧的同源 HTTP 桥(搜索 / 推荐流 / 收藏夹)。
 *  2. 收藏夹与登录态持久化:
 *     - <DSH_HOME>/pinterest-collect/collection.json  收藏夹
 *     - <DSH_HOME>/pinterest-collect/session.json     Pinterest 登录 cookie(0600,仅本机)
 *
 * 推荐流需要登录:Pinterest 没有免登录的个性化首页接口。登录走「打开真实 Chrome 窗口,
 * 用户自己完成登录,Host 通过 CDP 捕获 cookie」,不在插件里处理账号密码/验证码。
 *
 * 另外 Pinterest 禁止 iframe 嵌入(x-frame-options: SAMEORIGIN),所以右侧“webview”由
 * 客户端 React 渲染,而不是 <iframe src="pinterest.com">。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createPinterestClient } from './lib/pinterest.mjs'

const API_PREFIX = '/pinterest-api'
const VERSION = '1.2.0'
const DEFAULT_BOARD_ID = 'default'
const MAX_BODY = 256 * 1024
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const LOGIN_JOB_TTL_MS = 10 * 60 * 1000

export const name = 'pinterest-collect'
export const inject = ['webServer']

export function apply(ctx, config = {}) {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  const dataDir = config.dataDir || path.join(home, 'pinterest-collect')
  const collectionFile = path.join(dataDir, 'collection.json')
  const sessionFile = path.join(dataDir, 'session.json')
  const chromeProfileDir = path.join(dataDir, 'chrome-profile')
  const pinterest = createPinterestClient({ timeoutMs: Number(config.timeoutMs) || 12000 })
  // 登录器是可选模块:缺失也不能让整个面板挂掉(降级到「粘贴 Cookie」)。
  let browserLoginModule
  const getBrowserLogin = async () => {
    if (browserLoginModule !== undefined) return browserLoginModule
    try {
      browserLoginModule = await import('./lib/browser-login.mjs')
    } catch (error) {
      ctx.logger?.warn?.('pinterest-collect: browser-login module unavailable: %o', error)
      browserLoginModule = null
    }
    return browserLoginModule
  }

  /** 抓取客户端是否已经支持登录态接口(升级过程中的自保护)。 */
  const authApi = () => {
    const ready = typeof pinterest.importCookies === 'function'
      && typeof pinterest.exportCookies === 'function'
      && typeof pinterest.clearCookies === 'function'
      && typeof pinterest.feed === 'function'
      && typeof pinterest.probe === 'function'
    return { ready }
  }

  /** @type {null | { version: number, boards: any[], pins: any[], updatedAt?: string }} */
  let cache = null
  let writeChain = Promise.resolve()

  /** @type {null | { cookies: any[], updatedAt: string }} */
  let session = null
  let sessionLoaded = null
  /** @type {Map<string, any>} */
  const loginJobs = new Map()

  // ---------- 收藏夹 ----------

  function seedCollection() {
    const now = new Date().toISOString()
    return {
      version: 1,
      boards: [{ id: DEFAULT_BOARD_ID, title: '我的灵感', createdAt: now, isDefault: true }],
      pins: [],
      updatedAt: now
    }
  }

  function sanitize(raw) {
    const base = seedCollection()
    if (!raw || typeof raw !== 'object') return base
    const boards = Array.isArray(raw.boards) ? raw.boards.filter(b => b && typeof b.id === 'string') : []
    const pins = Array.isArray(raw.pins) ? raw.pins.filter(p => p && typeof p.savedId === 'string') : []
    if (!boards.some(b => b.id === DEFAULT_BOARD_ID)) boards.unshift(base.boards[0])
    const known = new Set(boards.map(b => b.id))
    for (const pin of pins) if (!known.has(pin.boardId)) pin.boardId = DEFAULT_BOARD_ID
    return { version: 1, boards, pins, updatedAt: raw.updatedAt || base.updatedAt }
  }

  async function load() {
    if (cache) return cache
    try {
      cache = sanitize(JSON.parse(await fs.readFile(collectionFile, 'utf8')))
    } catch (error) {
      if (error && error.code !== 'ENOENT') ctx.logger?.warn?.('pinterest-collect: collection unreadable, starting fresh: %o', error)
      cache = seedCollection()
    }
    return cache
  }

  function persist() {
    const snapshot = JSON.stringify(cache, null, 2)
    writeChain = writeChain.then(async () => {
      await fs.mkdir(dataDir, { recursive: true })
      const tmp = `${collectionFile}.${process.pid}.tmp`
      await fs.writeFile(tmp, snapshot, 'utf8')
      await fs.rename(tmp, collectionFile)
    })
    return writeChain
  }

  function view() {
    const col = cache
    const boards = [...col.boards].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
      return String(a.createdAt).localeCompare(String(b.createdAt))
    })
    const counts = new Map()
    for (const pin of col.pins) counts.set(pin.boardId, (counts.get(pin.boardId) || 0) + 1)
    return {
      boards: boards.map(b => ({ ...b, isDefault: b.isDefault === true || b.id === DEFAULT_BOARD_ID, count: counts.get(b.id) || 0 })),
      pins: [...col.pins].sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))),
      activeBoardId: 'all'
    }
  }

  // ---------- Pinterest 登录态 ----------

  async function ensureSession() {
    if (sessionLoaded) return sessionLoaded
    sessionLoaded = (async () => {
      try {
        const raw = JSON.parse(await fs.readFile(sessionFile, 'utf8'))
        const cookies = Array.isArray(raw && raw.cookies)
          ? raw.cookies.filter(cookie => cookie && typeof cookie.name === 'string' && typeof cookie.value === 'string')
          : []
        if (cookies.length) {
          session = { cookies, updatedAt: raw.updatedAt || new Date().toISOString() }
          const { ready } = authApi()
          if (ready) pinterest.importCookies(cookies)
        }
      } catch (error) {
        if (error && error.code !== 'ENOENT') ctx.logger?.warn?.('pinterest-collect: session unreadable: %o', error)
      }
      return session
    })()
    return sessionLoaded
  }

  async function persistSession(cookies) {
    const cleaned = (Array.isArray(cookies) ? cookies : []).map(cookie => ({
      name: String(cookie.name),
      value: String(cookie.value),
      domain: cookie.domain || '.pinterest.com',
      path: cookie.path || '/',
      secure: cookie.secure !== false,
      httpOnly: Boolean(cookie.httpOnly),
      expires: Number(cookie.expires) || -1
    }))
    session = { cookies: cleaned, updatedAt: new Date().toISOString() }
    viewerCache = null
    await fs.mkdir(dataDir, { recursive: true })
    const tmp = `${sessionFile}.${process.pid}.tmp`
    await fs.writeFile(tmp, JSON.stringify(session, null, 2), { encoding: 'utf8', mode: 0o600 })
    await fs.rename(tmp, sessionFile)
    const { ready } = authApi()
    if (ready) pinterest.importCookies(cleaned)
    return session
  }

  async function clearSession() {
    session = null
    viewerCache = null
    sessionLoaded = Promise.resolve(null)
    const { ready } = authApi()
    if (ready) pinterest.clearCookies()
    try {
      await fs.rm(sessionFile, { force: true })
    } catch (error) {
      ctx.logger?.warn?.('pinterest-collect: failed to remove session file: %o', error)
    }
  }

  async function accountView() {
    await ensureSession()
    const connected = Boolean(session && session.cookies && session.cookies.length)
    const link = await getBrowserLogin()
    const chrome = link && typeof link.findChrome === 'function' ? link.findChrome() : null
    const { ready } = authApi()
    let probe = { loggedIn: false }
    if (connected && ready) {
      try {
        probe = await pinterest.probe()
      } catch (error) {
        probe = { loggedIn: false, message: (error && error.message) || '登录态校验失败' }
      }
    }
    return {
      connected,
      valid: Boolean(probe && probe.loggedIn),
      updatedAt: session ? session.updatedAt : null,
      endpoint: probe && probe.endpoint ? probe.endpoint : null,
      message: probe && probe.message ? probe.message : null,
      authReady: ready,
      chromeAvailable: Boolean(chrome),
      chromeName: chrome ? chrome.name : null,
      viewer: null
    }
  }

  /** 登录用户的名称/头像:单独接口 + 30 分钟缓存,避免拖慢 /account。 */
  let viewerCache = null

  async function readViewer(force = false) {
    if (!force && viewerCache && Date.now() - viewerCache.at < 30 * 60 * 1000) return viewerCache.value
    await ensureSession()
    if (!session || !session.cookies.length || !authApi().ready) return null
    let value = null
    try {
      value = await pinterest.viewer()
    } catch {
      value = null
    }
    viewerCache = { at: Date.now(), value }
    return value
  }

  function viewerView(value) {
    if (!value) return null
    if (!value.username && !value.name && !value.avatar) return null
    return {
      username: value.username || '',
      name: value.name || '',
      avatar: value.avatar || '',
      pinCount: Number(value.pinCount) || 0,
      boardCount: Number(value.boardCount) || 0
    }
  }

  function pruneLoginJobs() {
    const now = Date.now()
    for (const [id, job] of loginJobs) {
      if (now - job.createdAt > LOGIN_JOB_TTL_MS) loginJobs.delete(id)
    }
  }

  async function startLoginJob() {
    pruneLoginJobs()
    const link = await getBrowserLogin()
    const chrome = link && typeof link.findChrome === 'function' ? link.findChrome() : null
    if (!link || !chrome) {
      const error = new Error('没有找到可用的 Chrome,请改用「手动粘贴 Cookie」连接')
      error.status = 409
      error.code = 'ENOCHROME'
      throw error
    }
    const id = `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const controller = new AbortController()
    const job = {
      id,
      createdAt: Date.now(),
      state: 'starting',
      message: '正在打开 Chrome…',
      controller,
      chrome
    }
    loginJobs.set(id, job)

    const run = async () => {
      try {
        const result = await link.startLogin({
          profileDir: chromeProfileDir,
          timeoutMs: LOGIN_TIMEOUT_MS,
          signal: controller.signal,
          onProgress: progress => {
            if (!progress) return
            job.state = progress.phase || job.state
            job.message = progress.message || job.message
          },
          onControl: control => {
            job.continueNow = control.continueNow
            job.cancel = control.cancel
          }
        })
        if (result.status === 'success') {
          await persistSession(result.cookies)
          job.state = 'probing'
          job.message = '登录成功,正在校验推荐流…'
          const probe = await pinterest.probe()
          if (probe && probe.loggedIn) {
            job.state = 'success'
            job.message = '已连接 Pinterest,推荐已就绪'
          } else {
            job.state = 'success'
            job.message = '已登录 Pinterest,但推荐流暂时读不到(可能是接口变化),可以稍后点「重新校验」'
          }
          job.probe = probe
        } else if (result.status === 'timeout') {
          job.state = 'timeout'
          job.message = '登录窗口等待超时,请重试'
        } else if (result.status === 'closed') {
          job.state = 'closed'
          job.message = '登录窗口已关闭'
        } else {
          job.state = 'failed'
          job.message = (result && result.message) || '登录失败'
        }
      } catch (error) {
        job.state = 'failed'
        job.message = (error && error.message) || '登录失败'
      } finally {
        controller.abort()
      }
    }

    job.promise = run()
    return job
  }

  // ---------- 输入校验与收藏动作 ----------

  function fail(message, status = 400) {
    const error = new Error(message)
    error.status = status
    return error
  }

  function cleanPin(input) {
    if (!input || typeof input !== 'object') throw fail('缺少 pin 数据')
    const id = typeof input.id === 'string' ? input.id.trim() : ''
    const image = typeof input.image === 'string' ? input.image.trim() : ''
    if (!id) throw fail('pin 缺少 id')
    if (!/^https?:\/\//.test(image)) throw fail('pin 缺少有效图片地址')
    const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '')
    return {
      id,
      title: text(input.title, 300),
      description: text(input.description, 2000),
      image,
      imageLarge: typeof input.imageLarge === 'string' ? input.imageLarge : image,
      width: Number(input.width) || 0,
      height: Number(input.height) || 0,
      dominantColor: text(input.dominantColor, 32),
      pinUrl: text(input.pinUrl, 500),
      sourceUrl: text(input.sourceUrl, 500),
      siteName: text(input.siteName, 120),
      pinner: {
        name: text(input.pinner && input.pinner.name, 120),
        username: text(input.pinner && input.pinner.username, 120)
      },
      board: {
        name: text(input.board && input.board.name, 160),
        url: text(input.board && input.board.url, 500)
      },
      isVideo: Boolean(input.isVideo)
    }
  }

  /** 备注:单行化、去首尾空格、最多 280 字符;空串表示没有备注。 */
  function normalizeNote(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, 280)
  }

  function ensureBoard(id) {
    const col = cache
    if (!id) return col.boards.find(b => b.id === DEFAULT_BOARD_ID)
    return col.boards.find(b => b.id === id) || col.boards.find(b => b.id === DEFAULT_BOARD_ID)
  }

  async function savePin(pin, boardId, note) {
    await load()
    const board = ensureBoard(boardId)
    const clean = cleanPin(pin)
    const noteText = normalizeNote(note)
    const existing = cache.pins.find(p => p.id === clean.id && p.boardId === board.id)
    if (existing) {
      // 重复收藏时如果这次带了备注,顺手补上/更新,不打断收藏动作
      if (noteText && existing.note !== noteText) {
        existing.note = noteText
        cache.updatedAt = new Date().toISOString()
        await persist()
        return { saved: existing, duplicate: true, updatedNote: true, collection: view() }
      }
      return { saved: existing, duplicate: true, collection: view() }
    }
    const saved = {
      ...clean,
      savedId: `${board.id}:${clean.id}`,
      boardId: board.id,
      savedAt: new Date().toISOString(),
      note: noteText
    }
    cache.pins.unshift(saved)
    cache.updatedAt = saved.savedAt
    await persist()
    return { saved, duplicate: false, collection: view() }
  }

  /** 给一条已收藏的 Pin 写/改备注(空串等于清除)。 */
  async function setNote(savedId, note) {
    await load()
    const pin = cache.pins.find(p => p.savedId === savedId)
    if (!pin) throw fail('没有找到这条收藏', 404)
    pin.note = normalizeNote(note)
    cache.updatedAt = new Date().toISOString()
    await persist()
    return { saved: pin, collection: view() }
  }

  async function unsave(savedId) {
    await load()
    const before = cache.pins.length
    cache.pins = cache.pins.filter(p => p.savedId !== savedId)
    if (cache.pins.length === before) throw fail('没有找到这条收藏', 404)
    cache.updatedAt = new Date().toISOString()
    await persist()
    return { ok: true, collection: view() }
  }

  async function createBoard(title) {
    await load()
    const name = String(title || '').trim()
    if (!name) throw fail('收藏夹名称不能为空')
    if (name.length > 40) throw fail('收藏夹名称不超过 40 个字')
    const board = {
      id: `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title: name,
      createdAt: new Date().toISOString()
    }
    cache.boards.push(board)
    await persist()
    return { board, collection: view() }
  }

  async function renameBoard(id, title) {
    await load()
    const board = cache.boards.find(b => b.id === id)
    if (!board) throw fail('收藏夹不存在', 404)
    const name = String(title || '').trim()
    if (!name) throw fail('收藏夹名称不能为空')
    board.title = name.slice(0, 40)
    await persist()
    return { board, collection: view() }
  }

  async function removeBoard(id) {
    await load()
    if (id === DEFAULT_BOARD_ID) throw fail('默认收藏夹不能删除')
    const index = cache.boards.findIndex(b => b.id === id)
    if (index < 0) throw fail('收藏夹不存在', 404)
    cache.boards.splice(index, 1)
    for (const pin of cache.pins) if (pin.boardId === id) pin.boardId = DEFAULT_BOARD_ID
    await persist()
    return { ok: true, collection: view() }
  }

  // ---------- HTTP ----------

  function sendJSON(res, status, payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(body.length),
      'cache-control': 'no-store'
    })
    res.end(body)
  }

  async function readBody(req) {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > MAX_BODY) throw fail('请求体过大', 413)
      chunks.push(chunk)
    }
    if (!chunks.length) return {}
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      throw fail('请求体不是合法 JSON')
    }
  }

  async function handle(req, res) {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const route = url.pathname.startsWith(API_PREFIX) ? url.pathname.slice(API_PREFIX.length) || '/' : null
    if (route === null) {
      sendJSON(res, 404, { error: 'not found' })
      return
    }
    const method = req.method || 'GET'

    try {
      if (method === 'GET' && route === '/health') {
        let pinterestState = { ready: false }
        try {
          pinterestState = await pinterest.health()
        } catch (error) {
          pinterestState = { ready: false, error: (error && error.message) || 'Pinterest 不可用' }
        }
        sendJSON(res, 200, {
          ok: true,
          version: VERSION,
          prefix: API_PREFIX,
          pinterest: pinterestState,
          authReady: authApi().ready,
          account: await accountView()
        })
        return
      }

      // ---- 账号 ----
      if (method === 'GET' && route === '/account') {
        sendJSON(res, 200, await accountView())
        return
      }
      if (method === 'GET' && route === '/account/viewer') {
        const viewer = await readViewer(url.searchParams.get('force') === '1')
        sendJSON(res, 200, { viewer: viewerView(viewer) })
        return
      }
      if (method === 'POST' && route === '/account/login/start') {
        const job = await startLoginJob()
        sendJSON(res, 200, { jobId: job.id, state: job.state, message: job.message, chrome: { name: job.chrome.name } })
        return
      }
      if (method === 'GET' && route === '/account/login/status') {
        const jobId = url.searchParams.get('jobId') || ''
        const job = loginJobs.get(jobId)
        if (!job) throw fail('登录任务不存在或已过期', 404)
        const done = ['success', 'failed', 'timeout', 'closed'].includes(job.state)
        const account = job.state === 'success' ? await accountView() : null
        sendJSON(res, 200, { state: job.state, message: job.message, done, account })
        return
      }
      if (method === 'POST' && route === '/account/login/continue') {
        const body = await readBody(req)
        const job = loginJobs.get(String(body.jobId || ''))
        if (!job) throw fail('登录任务不存在或已过期', 404)
        if (typeof job.continueNow !== 'function') throw fail('登录窗口还在启动,请稍等一秒再点', 409)
        const accepted = job.continueNow()
        sendJSON(res, 200, { ok: accepted, state: job.state, message: accepted ? '正在读取登录态…' : '登录窗口已经关闭' })
        return
      }
      if (method === 'POST' && route === '/account/login/cancel') {
        const body = await readBody(req)
        const job = loginJobs.get(String(body.jobId || ''))
        if (job) {
          job.state = 'closed'
          job.message = '已取消登录'
          try {
            job.controller.abort()
          } catch {
            /* 忽略 */
          }
        }
        sendJSON(res, 200, { ok: true })
        return
      }
      if (method === 'POST' && route === '/account/cookies') {
        const { ready } = authApi()
        if (!ready) throw fail('登录模块还在升级,请重启 Harness 后重试', 503)
        const body = await readBody(req)
        const raw = body.cookieString || body.cookies
        if (!raw) throw fail('请粘贴 Pinterest 的 cookie')
        let imported = 0
        try {
          imported = typeof raw === 'string'
            ? pinterest.importCookies(raw)
            : pinterest.importCookies(Array.isArray(raw) ? raw : [])
        } catch (error) {
          throw fail((error && error.message) || 'Cookie 格式无法识别')
        }
        if (!imported) throw fail('Cookie 里没有识别到 Pinterest 的字段(_pinterest_sess / csrftoken)')
        const probe = await pinterest.probe()
        if (!probe || !probe.loggedIn) {
          pinterest.clearCookies()
          throw fail('这些 Cookie 还不是登录态(缺少 _auth=1),请在登录后重新复制', 400)
        }
        await persistSession(pinterest.exportCookies())
        sendJSON(res, 200, { connected: true, valid: true, imported, account: await accountView() })
        return
      }
      if (method === 'POST' && route === '/account/logout') {
        await clearSession()
        sendJSON(res, 200, { connected: false, ok: true })
        return
      }
      if (method === 'POST' && route === '/account/verify') {
        const { ready } = authApi()
        if (!ready) throw fail('登录模块还在升级,请重启 Harness 后重试', 503)
        await ensureSession()
        const probe = await pinterest.probe()
        sendJSON(res, 200, { valid: Boolean(probe && probe.loggedIn), message: (probe && probe.message) || null, account: await accountView() })
        return
      }

      // ---- 账号页:当前登录用户自己的 Pin(需登录) ----
      if (method === 'GET' && route === '/account/pins') {
        await ensureSession()
        if (!session || !session.cookies.length) throw fail('需要先登录 Pinterest', 401)
        if (!authApi().ready) throw fail('推荐/账号模块还在升级,请重启 Harness 后重试', 503)
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 24, 1), 50)
        const cachedViewer = await readViewer()
        try {
          const result = await pinterest.userPins({
            username: cachedViewer ? cachedViewer.username : undefined,
            bookmark: url.searchParams.get('bookmark') || undefined,
            limit
          })
          sendJSON(res, 200, { pins: result.pins || [], bookmark: result.bookmark || null, username: result.username || '' })
        } catch (error) {
          if (error && error.code === 'EAUTH') throw fail(error.message || '需要重新登录 Pinterest', 401)
          throw error
        }
        return
      }

      // ---- 推荐流(需登录) ----
      if (method === 'GET' && route === '/feed') {
        const { ready } = authApi()
        if (!ready) throw fail('推荐流模块还在升级,请重启 Harness 后重试', 503)
        await ensureSession()
        if (!session || !session.cookies.length) throw fail('需要先登录 Pinterest 才能看推荐', 401)
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 24, 1), 50)
        try {
          const result = await pinterest.feed({ bookmark: url.searchParams.get('bookmark') || undefined, limit })
          sendJSON(res, 200, { pins: result.pins || [], bookmark: result.bookmark || null, endpoint: result.endpoint || null })
        } catch (error) {
          if (error && error.code === 'EAUTH') throw fail(error.message || '需要重新登录 Pinterest', 401)
          throw error
        }
        return
      }

      // ---- 收藏夹 ----
      if (method === 'GET' && route === '/collection') {
        await load()
        sendJSON(res, 200, view())
        return
      }
      if (method === 'GET' && route === '/search') {
        const query = (url.searchParams.get('q') || '').trim()
        if (!query) throw fail('请输入搜索关键词')
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 24, 1), 50)
        const result = await pinterest.search({ query, bookmark: url.searchParams.get('bookmark') || undefined, limit })
        sendJSON(res, 200, { pins: result.pins, bookmark: result.bookmark || null, query })
        return
      }
      if (method === 'GET' && route === '/related') {
        const id = (url.searchParams.get('id') || '').trim()
        if (!id) throw fail('缺少 pin id')
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 24, 1), 50)
        // Pinterest 没有公开的 related 接口,这里用标题/描述做回退搜索;
        // 标题太短(比如只有一个词)时用描述,召回会更像「同类内容」
        const title = (url.searchParams.get('title') || '').trim()
        const description = (url.searchParams.get('description') || '').trim()
        const query = title.length >= 8 ? title : description || title
        const result = await pinterest.related({ id, title: query, limit })
        sendJSON(res, 200, { pins: result.pins, bookmark: result.bookmark || null })
        return
      }
      if (method === 'GET' && route === '/resolve') {
        const target = (url.searchParams.get('url') || '').trim()
        if (!target) throw fail('缺少 url 参数')
        sendJSON(res, 200, await pinterest.resolveUrl(target))
        return
      }
      if (method === 'POST' && route === '/save') {
        const body = await readBody(req)
        const result = await savePin(body.pin, body.boardId, body.note)
        sendJSON(res, 200, result)
        return
      }
      if (method === 'POST' && route === '/collection/note') {
        const body = await readBody(req)
        sendJSON(res, 200, await setNote(String(body.savedId || ''), body.note))
        return
      }
      if (method === 'POST' && route === '/unsave') {
        const body = await readBody(req)
        sendJSON(res, 200, await unsave(String(body.savedId || '')))
        return
      }
      if (method === 'POST' && route === '/collection/boards') {
        const body = await readBody(req)
        sendJSON(res, 200, await createBoard(body.title))
        return
      }
      if (method === 'POST' && route === '/collection/boards/rename') {
        const body = await readBody(req)
        sendJSON(res, 200, await renameBoard(String(body.id || ''), body.title))
        return
      }
      if (method === 'POST' && route === '/collection/boards/remove') {
        const body = await readBody(req)
        sendJSON(res, 200, await removeBoard(String(body.id || '')))
        return
      }
      sendJSON(res, 404, { error: `未知接口 ${method} ${route}` })
    } catch (error) {
      const status = Number(error && error.status) || (error && error.statusCode) || 500
      const message = error && error.message ? error.message : '服务异常'
      if (status >= 500) ctx.logger?.warn?.('pinterest-collect: %s %s failed: %o', method, route, error)
      sendJSON(res, status, { error: message, code: (error && error.code) || undefined })
    }
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler: handle }))
  void ensureSession()
  ctx.logger?.info?.('pinterest-collect: API mounted at %s (data: %s)', API_PREFIX, dataDir)
}
