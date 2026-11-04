/**
 * Pinterest 登录器（Host 侧，零第三方依赖 / Node 22 / 全局 WebSocket）
 *
 * 做一件事：打开一个**真实的系统 Chrome 窗口**，让用户自己在里面登录 Pinterest
 * （账号密码、Google 登录、验证码、2FA 全部由 Chrome 处理，插件不接触任何凭据），
 * 同时用 CDP（Chrome DevTools Protocol）在后台盯着 Cookie，`_auth=1` 且
 * `_pinterest_sess` 非空即视为登录成功，随后把 Pinterest 域的 Cookie 交给调用方，
 * 并关闭 Chrome、确保不留进程。
 *
 * 关键实现
 * - `--remote-debugging-port=0` + `<profileDir>/DevToolsActivePort`：端口由 Chrome 自己挑，
 *   从文件第一行读到端口后再 `GET /json/version` 拿 webSocketDebuggerUrl。
 * - 最小 CDP 客户端：自增 id + 等 `id` 匹配的响应；`Target.attachToTarget({flatten:true})`
 *   拿到 page 的 sessionId 后 `Network.enable`。
 * - 每 1.5s 读一次 `Network.getAllCookies`（Chrome 156 起该命令只在 page session 里可用，
 *   浏览器级会 -32601，因此按 page session → `Storage.getCookies` → 浏览器级 依次降级），
 *   过滤 pinterest.com 域。
 * - 收尾顺序：`Browser.close` → 等子进程 exit（3s）→ 等不到就 SIGKILL；WS 一定关闭。
 * - 复用同一个 profile 目录时，下次打开可能直接就是登录态（首次轮询即成功）。
 *
 * 该模块只依赖 node 内置模块（child_process / fs / path），不安装任何 npm 依赖。
 */

import { spawn } from 'node:child_process';
import { accessSync, constants as FS_CONSTANTS, existsSync, promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Pinterest 主域（含子域 / 前导点） */
const PINTEREST_DOMAIN = 'pinterest.com';
/** 等 DevToolsActivePort 出现的最长时间 */
const DEVTOOLS_PORT_TIMEOUT_MS = 20000;
/** 登录成功后额外等待一下，让页面把剩余 Cookie 写完 */
const SUCCESS_SETTLE_MS = 500;
/** 轮询 getCookies 的间隔 */
const COOKIE_POLL_INTERVAL_MS = 1500;
/** CDP 单条命令超时 */
const CDP_COMMAND_TIMEOUT_MS = 15000;
/** Browser.close 之后等 Chrome 退出的时间，超时 SIGKILL */
const CHILD_EXIT_TIMEOUT_MS = 3000;
/** 窗口大小：登录页在 1100x860 下显示完整 */
const DEFAULT_WINDOW_SIZE = '1100,860';

// ---------------------------------------------------------------------------
// Chrome 探测
// ---------------------------------------------------------------------------

/** macOS 下的候选（按优先级）：Chrome / Chromium / Edge / Brave */
const MAC_CANDIDATES = [
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'Google Chrome'],
  ['/Applications/Chromium.app/Contents/MacOS/Chromium', 'Chromium'],
  ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'Microsoft Edge'],
  ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', 'Brave Browser'],
  ['~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'Google Chrome'],
  ['~/Applications/Chromium.app/Contents/MacOS/Chromium', 'Chromium'],
];

/** Linux 下的候选：绝对路径 + PATH 里的常见命令名 */
const LINUX_ABSOLUTE_CANDIDATES = [
  ['/usr/bin/google-chrome', 'Google Chrome'],
  ['/usr/bin/google-chrome-stable', 'Google Chrome'],
  ['/opt/google/chrome/chrome', 'Google Chrome'],
  ['/usr/bin/chromium', 'Chromium'],
  ['/usr/bin/chromium-browser', 'Chromium'],
  ['/snap/bin/chromium', 'Chromium'],
  ['/usr/bin/microsoft-edge', 'Microsoft Edge'],
  ['/usr/bin/brave-browser', 'Brave Browser'],
];
const LINUX_PATH_COMMANDS = [
  ['google-chrome', 'Google Chrome'],
  ['google-chrome-stable', 'Google Chrome'],
  ['chromium', 'Chromium'],
  ['chromium-browser', 'Chromium'],
  ['microsoft-edge', 'Microsoft Edge'],
  ['brave-browser', 'Brave Browser'],
];

/** Windows 下的候选（%PROGRAMFILES% 等由环境变量展开） */
const WINDOWS_CANDIDATES = [
  ['%PROGRAMFILES%\\Google\\Chrome\\Application\\chrome.exe', 'Google Chrome'],
  ['%PROGRAMFILES(X86)%\\Google\\Chrome\\Application\\chrome.exe', 'Google Chrome'],
  ['%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe', 'Google Chrome'],
  ['%PROGRAMFILES%\\Microsoft\\Edge\\Application\\msedge.exe', 'Microsoft Edge'],
  ['%PROGRAMFILES(X86)%\\Microsoft\\Edge\\Application\\msedge.exe', 'Microsoft Edge'],
  ['%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe', 'Brave Browser'],
];

function isExecutableFile(candidate) {
  if (!candidate) return false;
  try {
    accessSync(candidate, FS_CONSTANTS.X_OK);
    return true;
  } catch {
    return false;
  }
}

function expandHome(p) {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
}

function expandEnvPath(p) {
  return p.replace(/%([^%]+)%/g, (whole, name) => process.env[name] || whole);
}

/** PATH 里查找可执行命令（Linux 兜底探测，不依赖 `which`） */
function findInPath(command) {
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const full = path.join(dir, command);
    if (isExecutableFile(full)) return full;
  }
  return '';
}

function buildCandidates() {
  const list = [];
  if (process.platform === 'darwin') {
    for (const [p, name] of MAC_CANDIDATES) list.push([expandHome(p), name, false]);
    return list;
  }
  if (process.platform === 'win32') {
    for (const [p, name] of WINDOWS_CANDIDATES) list.push([expandEnvPath(p), name, false]);
    return list;
  }
  for (const [p, name] of LINUX_ABSOLUTE_CANDIDATES) list.push([p, name, false]);
  for (const [command, name] of LINUX_PATH_COMMANDS) list.push([command, name, true]);
  return list;
}

/**
 * 找一个可用的 Chromium 系浏览器。
 * 优先 `env.CHROME_PATH`（存在且可执行时覆盖一切），否则按平台候选顺序探测。
 * @returns {{ path: string, name: string } | null}
 */
export function findChrome() {
  const override = typeof process.env.CHROME_PATH === 'string' ? process.env.CHROME_PATH.trim() : '';
  if (override) {
    const resolved = expandHome(expandEnvPath(override));
    if (isExecutableFile(resolved)) return { path: resolved, name: path.basename(resolved).replace(/\.exe$/i, '') || 'Chrome' };
    if (existsSync(resolved)) return { path: resolved, name: 'Chrome（CHROME_PATH）' };
  }
  for (const [candidate, name, fromPath] of buildCandidates()) {
    const resolved = fromPath ? findInPath(candidate) : candidate;
    if (resolved && isExecutableFile(resolved)) return { path: resolved, name };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** 可被 signal 提前唤醒的 sleep（abort 不抛错，交给调用方判断） */
function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    let timer = null;
    const onAbort = () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** promise 加超时：超时返回 fallback（不 reject） */
function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

function safeProgress(onProgress) {
  return (phase, message) => {
    try {
      onProgress?.({ phase, message });
    } catch {
      /* 进度回调不允许影响登录流程 */
    }
  };
}

function isPinterestCookieDomain(domain) {
  const d = typeof domain === 'string' ? domain.trim().toLowerCase().replace(/^\./, '') : '';
  return d === PINTEREST_DOMAIN || d.endsWith(`.${PINTEREST_DOMAIN}`);
}

function normalizeCookieList(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList.filter(
    (cookie) =>
      cookie &&
      typeof cookie.name === 'string' &&
      cookie.name !== '' &&
      typeof cookie.value === 'string' &&
      isPinterestCookieDomain(cookie.domain)
  );
}

// ---------------------------------------------------------------------------
// 最小 CDP 客户端（Node 22 全局 WebSocket）
// ---------------------------------------------------------------------------

function waitSocketOpen(ws, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (ws.readyState === 1) {
      resolve();
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('CDP WebSocket 连接超时'));
    }, timeoutMs);
    ws.addEventListener(
      'open',
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
    ws.addEventListener(
      'error',
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error('CDP WebSocket 连接失败'));
      },
      { once: true }
    );
  });
}

/**
 * @param {WebSocket} ws
 */
function createCdpConnection(ws) {
  let nextId = 0;
  let closed = false;
  const pending = new Map();
  const listeners = new Set();

  function rejectAll(reason) {
    for (const [id, entry] of pending) {
      pending.delete(id);
      clearTimeout(entry.timer);
      entry.reject(new Error(reason));
    }
  }

  ws.addEventListener('message', (event) => {
    let message;
    try {
      const data = event.data;
      message = JSON.parse(typeof data === 'string' ? data : Buffer.from(data).toString('utf8'));
    } catch {
      return;
    }
    if (message && typeof message.id === 'number' && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) {
        const error = new Error(`CDP ${message.method || '命令'} 失败：${message.error.message || JSON.stringify(message.error)}`);
        error.code = message.error.code;
        entry.reject(error);
      } else {
        entry.resolve(message.result ?? {});
      }
      return;
    }
    if (message && typeof message.method === 'string') {
      for (const listener of listeners) {
        try {
          listener(message);
        } catch {
          /* 事件监听器异常不影响 CDP 主流程 */
        }
      }
    }
  });

  ws.addEventListener('close', () => {
    closed = true;
    rejectAll('CDP 连接已关闭');
  });
  ws.addEventListener('error', () => {
    /* 连接错误由 send/rejectAll 体现，这里吞掉避免 uncaught */
  });

  /**
   * @param {string} method
   * @param {object} [params]
   * @param {string} [sessionId] flat 模式下的会话 id；不传即浏览器级命令
   */
  function send(method, params = {}, sessionId) {
    if (closed) return Promise.reject(new Error('CDP 连接已关闭'));
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error(`CDP 命令超时（${CDP_COMMAND_TIMEOUT_MS}ms）：${method}`));
      }, CDP_COMMAND_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      const payload = { id, method };
      if (params && Object.keys(params).length) payload.params = params;
      if (sessionId) payload.sessionId = sessionId;
      try {
        ws.send(JSON.stringify(payload));
      } catch (error) {
        pending.delete(id);
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  return {
    send,
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      try {
        ws.close();
      } catch {
        /* 已关闭 */
      }
    },
    get isClosed() {
      return closed;
    },
  };
}

// ---------------------------------------------------------------------------
// startLogin
// ---------------------------------------------------------------------------

/**
 * 打开真实 Chrome 让用户登录 Pinterest，捕获登录 Cookie 后关闭浏览器。
 *
 * @param {object} options
 * @param {string} options.profileDir        独立 Chrome 用户数据目录（不要用用户日常 profile）
 * @param {string} [options.loginUrl]        起始页，默认 Pinterest 登录页
 * @param {number} [options.timeoutMs]       等待登录的总超时，默认 5 分钟
 * @param {boolean} [options.headless]       无头模式（仅测试用；不给用户弹窗）
 * @param {AbortSignal} [options.signal]     取消信号（取消后按 closed 收尾并清理进程）
 * @param {(p:{phase:string,message:string})=>void} [options.onProgress]
 * @returns {Promise<{ status: 'success'|'timeout'|'closed'|'error', cookies: object[], message: string }>}
 *   cookies 为 CDP Cookie 原始对象（已过滤 pinterest.com 域）；timeout/closed 时返回最后一次快照。
 */
export async function startLogin({
  profileDir,
  loginUrl = 'https://www.pinterest.com/login/',
  timeoutMs = 300000,
  headless = false,
  signal,
  onProgress,
} = {}) {
  const progress = safeProgress(onProgress);
  const startedAt = Date.now();
  const totalTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.round(timeoutMs) : 300000;
  const deadline = startedAt + totalTimeout;

  const state = {
    child: null,
    childExited: false,
    exitPromise: null,
    stderrTail: '',
    ws: null,
    cdp: null,
  };

  const result = await (async () => {
    if (!profileDir || typeof profileDir !== 'string') {
      return { status: 'error', cookies: [], message: '缺少 profileDir，无法创建独立的 Chrome 用户数据目录' };
    }
    if (signal?.aborted) {
      return { status: 'closed', cookies: [], message: '登录已取消' };
    }

    const chrome = findChrome();
    if (!chrome) {
      return {
        status: 'error',
        cookies: [],
        message: '没有找到 Chrome / Chromium / Edge / Brave，请安装 Chrome，或用 CHROME_PATH 指定浏览器路径',
      };
    }

    try {
      await fsp.mkdir(profileDir, { recursive: true });
    } catch (error) {
      return { status: 'error', cookies: [], message: `无法创建 Chrome 用户数据目录：${error?.message || error}` };
    }

    const portFile = path.join(profileDir, 'DevToolsActivePort');
    // 复用 profile 时，上一次运行可能留下过期端口文件，先清掉避免连到旧端口
    await fsp.rm(portFile, { force: true }).catch(() => {});

    const args = [
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--window-size=${DEFAULT_WINDOW_SIZE}`,
    ];
    if (headless) args.push('--headless=new', '--disable-gpu');
    if (loginUrl) args.push(loginUrl);

    progress('launching', `正在打开 ${chrome.name}…`);

    let spawnError = null;
    try {
      state.child = spawn(chrome.path, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (error) {
      return { status: 'error', cookies: [], message: `启动 Chrome 失败：${error?.message || error}` };
    }
    state.child.stderr?.on('data', (chunk) => {
      // 只留最后一段，用于启动失败时给出可读原因
      state.stderrTail = (state.stderrTail + String(chunk)).slice(-4000);
    });
    state.exitPromise = new Promise((resolve) => {
      state.child.once('exit', () => {
        state.childExited = true;
        resolve(true);
      });
      state.child.once('error', (error) => {
        spawnError = error;
        state.childExited = true;
        resolve(false);
      });
    });

    // 1) 等 DevToolsActivePort（最多 20s，且不超过总超时）
    progress('launching', `等待 ${chrome.name} 就绪…`);
    const portWaitDeadline = Math.min(deadline, startedAt + DEVTOOLS_PORT_TIMEOUT_MS);
    let port = 0;
    while (Date.now() < portWaitDeadline) {
      if (signal?.aborted) break;
      if (state.childExited) break;
      try {
        const text = await fsp.readFile(portFile, 'utf8');
        const firstLine = String(text).split(/\r?\n/)[0].trim();
        const parsed = Number.parseInt(firstLine, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          port = parsed;
          break;
        }
      } catch {
        /* 文件还没出现 */
      }
      await sleep(100, signal);
    }

    if (!port) {
      if (signal?.aborted) return { status: 'closed', cookies: [], message: '登录已取消' };
      if (state.childExited) {
        const detail = spawnError ? `：${spawnError.message}` : state.stderrTail ? `：${state.stderrTail.split('\n').slice(-3).join(' ').slice(-300)}` : '';
        return {
          status: 'error',
          cookies: [],
          message: `Chrome 启动后立即退出（用户数据目录可能正被另一个 Chrome 实例占用）${detail}`,
        };
      }
      return { status: 'error', cookies: [], message: `Chrome 未在 ${DEVTOOLS_PORT_TIMEOUT_MS / 1000}s 内打开调试端口，可能被安全软件拦截` };
    }

    // 2) /json/version → webSocketDebuggerUrl
    let version = null;
    while (Date.now() < Math.min(deadline, startedAt + DEVTOOLS_PORT_TIMEOUT_MS + 5000)) {
      if (signal?.aborted || state.childExited) break;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const json = await res.json();
          if (json && typeof json.webSocketDebuggerUrl === 'string') {
            version = json;
            break;
          }
        }
      } catch {
        /* Chrome 还没把 HTTP 端点拉起来 */
      }
      await sleep(200, signal);
    }
    if (!version) {
      if (signal?.aborted) return { status: 'closed', cookies: [], message: '登录已取消' };
      if (state.childExited) return { status: 'closed', cookies: [], message: 'Chrome 窗口已关闭' };
      return { status: 'error', cookies: [], message: '无法读取 Chrome 调试端点的版本信息（/json/version）' };
    }

    // 3) 连接 WebSocket + attach page + Network.enable
    progress('launching', '正在连接 Chrome 调试通道…');
    try {
      state.ws = new WebSocket(version.webSocketDebuggerUrl);
    } catch (error) {
      return { status: 'error', cookies: [], message: `无法连接 Chrome 调试通道：${error?.message || error}` };
    }
    try {
      await waitSocketOpen(state.ws, 5000);
    } catch (error) {
      return { status: 'error', cookies: [], message: error?.message || '无法连接 Chrome 调试通道' };
    }
    state.cdp = createCdpConnection(state.ws);

    let sessionId = null;
    for (let attempt = 0; attempt < 20 && !sessionId; attempt += 1) {
      if (signal?.aborted || state.childExited) break;
      try {
        const { targetInfos } = await state.cdp.send('Target.getTargets');
        const pages = Array.isArray(targetInfos) ? targetInfos.filter((t) => t && t.type === 'page') : [];
        const target = pages.find((t) => /pinterest\.com/i.test(String(t.url || ''))) || pages[0];
        if (target) {
          const attached = await state.cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
          if (attached && typeof attached.sessionId === 'string') sessionId = attached.sessionId;
        }
      } catch {
        /* 页面还没建好，重试 */
      }
      if (!sessionId) await sleep(300, signal);
    }
    if (sessionId) {
      // Network.enable 失败不影响浏览器级 getAllCookies，按尽力而为处理
      await withTimeout(state.cdp.send('Network.enable', {}, sessionId), 5000, null);
    }
    if (signal?.aborted) return { status: 'closed', cookies: [], message: '登录已取消' };
    if (state.childExited) return { status: 'closed', cookies: [], message: 'Chrome 窗口已关闭' };

    // 4) 轮询 cookie，直到 _auth=1 且 _pinterest_sess 非空
    /**
     * 读一次 Pinterest Cookie。命令可用性随 Chrome 版本变化：
     * Chrome 156 起 `Network.getAllCookies` 只在 page session 上存在（浏览器级 -32601），
     * 所以用 page session 优先，再用浏览器级 `Storage.getCookies` 兜底。
     */
    async function readCookies() {
      const attempts = [];
      if (sessionId) attempts.push(() => state.cdp.send('Network.getAllCookies', {}, sessionId));
      attempts.push(() => state.cdp.send('Storage.getCookies', {}));
      attempts.push(() => state.cdp.send('Network.getAllCookies'));
      let lastError = null;
      for (const attempt of attempts) {
        try {
          const result = await attempt();
          return normalizeCookieList(result?.cookies);
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error('无法读取 Chrome Cookie');
    }

    progress('waiting-login', '请在 Chrome 窗口里登录 Pinterest（登录成功后窗口会自动关闭）…');
    let lastCookies = [];
    let pollError = null;
    while (Date.now() < deadline) {
      if (signal?.aborted) return { status: 'closed', cookies: lastCookies, message: '登录已取消' };
      if (state.childExited) return { status: 'closed', cookies: lastCookies, message: 'Chrome 窗口已关闭，没有捕获到登录状态' };
      if (state.cdp.isClosed) break;

      let cookies = null;
      try {
        cookies = await readCookies();
        pollError = null;
      } catch (error) {
        pollError = error;
        if (state.childExited || state.cdp.isClosed || signal?.aborted) break;
      }
      if (cookies) {
        lastCookies = cookies;
        const auth = cookies.find((c) => c.name === '_auth');
        const sess = cookies.find((c) => c.name === '_pinterest_sess');
        if (auth && auth.value === '1' && sess && sess.value) {
          progress('cookies-found', '已捕获 Pinterest 登录 Cookie，正在收尾…');
          await sleep(SUCCESS_SETTLE_MS, signal);
          if (!state.childExited && !state.cdp.isClosed) {
            try {
              const settled = await readCookies();
              if (settled.length) lastCookies = settled;
            } catch {
              /* 用上一次快照 */
            }
          }
          return { status: 'success', cookies: lastCookies, message: '已登录 Pinterest，登录 Cookie 已捕获' };
        }
      }
      await sleep(COOKIE_POLL_INTERVAL_MS, signal);
    }

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    if (state.childExited) return { status: 'closed', cookies: lastCookies, message: 'Chrome 窗口已关闭，没有捕获到登录状态' };
    if (signal?.aborted) return { status: 'closed', cookies: lastCookies, message: '登录已取消' };
    return {
      status: 'timeout',
      cookies: lastCookies,
      message: pollError
        ? `等待登录超时（${elapsed}s）：${pollError.message || pollError}`
        : `等待登录超时（${elapsed}s），请重试并完成 Pinterest 登录`,
    };
  })();

  // 5) 收尾：一定要关浏览器、关 WS、确认进程退出
  progress(result.status === 'success' ? 'closing' : 'closing', result.status === 'success' ? '登录完成，正在关闭 Chrome…' : '正在关闭 Chrome…');
  await closeEverything(state);

  return result;
}

async function closeEverything(state) {
  // Browser.close 优雅退出
  if (state.cdp && !state.cdp.isClosed) {
    await withTimeout(state.cdp.send('Browser.close'), 1500, null);
  }
  if (state.ws) {
    try {
      state.ws.close();
    } catch {
      /* 已关闭 */
    }
  }
  if (state.child && !state.childExited) {
    const exited = await withTimeout(state.exitPromise || Promise.resolve(false), CHILD_EXIT_TIMEOUT_MS, false);
    if (!exited && !state.childExited) {
      try {
        state.child.kill('SIGKILL');
      } catch {
        /* 已退出 */
      }
      await withTimeout(state.exitPromise || Promise.resolve(false), 2000, false);
    }
  }
}


/* ------------------------------------------------------------------------- *
 * 两段式交互登录(给「一键登录」用)
 *
 * 背景:Chrome 近期版本里,带 --remote-debugging-port 启动会让页面的
 * navigator.webdriver 变成 true,Google 会因此判定「此浏览器或应用可能不安全」
 * 并拒绝登录。所以交互登录窗口必须是一个**不带任何调试/自动化开关**的干净 Chrome。
 *
 * 阶段 A:干净 Chrome 打开 Pinterest 登录页,用户自己登录(可用 Google/验证码/2FA),
 *        Host 全程不连调试端口;用户点「我已完成登录」或直接 ⌘Q 退出窗口后进入阶段 B。
 * 阶段 B:用同一个 profile 以 headless + 调试端口启动一次性实例,只读 cookie,
 *        读完立刻关闭(此时没有 Google 页面,不会触发风控)。
 * ------------------------------------------------------------------------- */

/**
 * 交互式登录(阶段 A + 阶段 B)。返回结构与 startLogin 完全一致。
 *
 * @param {object} options
 * @param {string} options.profileDir
 * @param {string} [options.loginUrl]
 * @param {number} [options.timeoutMs]
 * @param {AbortSignal} [options.signal]
 * @param {(p:{phase:string,message:string})=>void} [options.onProgress]
 * @param {(control:{continueNow:()=>boolean,cancel:()=>boolean})=>void} [options.onControl]
 *   把控制权交给调用方:continueNow() 表示用户确认登录完成,提前进入阶段 B;cancel() 等价取消。
 * @param {boolean} [options.headlessPhaseA] 仅测试用:阶段 A 也用 headless(不会有人真的登录)
 */
export async function startLoginInteractive({
  profileDir,
  loginUrl = 'https://www.pinterest.com/login/',
  timeoutMs = 300000,
  signal,
  onProgress,
  onControl,
  headlessPhaseA = false,
} = {}) {
  const progress = safeProgress(onProgress);
  const chrome = findChrome();
  if (!chrome) {
    return {
      status: 'error',
      cookies: [],
      message: '没有找到 Chrome / Chromium / Edge / Brave，请安装 Chrome，或用 CHROME_PATH 指定浏览器路径',
    };
  }
  if (!profileDir || typeof profileDir !== 'string') {
    return { status: 'error', cookies: [], message: '缺少 profileDir，无法创建独立的 Chrome 用户数据目录' };
  }
  try {
    await fsp.mkdir(profileDir, { recursive: true });
  } catch (error) {
    return { status: 'error', cookies: [], message: `无法创建 Chrome 用户数据目录：${error?.message || error}` };
  }

  const totalTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.round(timeoutMs) : 300000;
  const deadline = Date.now() + totalTimeout;

  // 复用 profile 时清掉上一次留下的调试端口文件(本轮阶段 A 不带调试端口)
  await fsp.rm(path.join(profileDir, 'DevToolsActivePort'), { force: true }).catch(() => {});

  const args = [
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${DEFAULT_WINDOW_SIZE}`,
  ];
  // 注意:这里**不能**加 --remote-debugging-port / --enable-automation
  if (headlessPhaseA) args.push('--headless=new', '--disable-gpu');
  if (loginUrl) args.push(loginUrl);

  progress('launching', `正在打开 ${chrome.name} 登录窗口…`);
  let child = null;
  try {
    child = spawn(chrome.path, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (error) {
    return { status: 'error', cookies: [], message: `启动 Chrome 失败：${error?.message || error}` };
  }

  let exited = false;
  let exitCode = null;
  let stderrTail = '';
  child.stderr?.on('data', (chunk) => {
    stderrTail = (stderrTail + String(chunk)).slice(-4000);
  });
  const exitPromise = new Promise((resolve) => {
    child.once('exit', (code) => {
      exited = true;
      exitCode = code;
      resolve(true);
    });
    child.once('error', () => {
      exited = true;
      resolve(false);
    });
  });

  // 等待期间给调用方的控制句柄
  let continueRequested = false;
  let cancelRequested = false;
  const waiters = new Set();
  const wake = () => {
    for (const resolve of waiters) resolve();
    waiters.clear();
  };
  const continueNow = () => {
    if (exited) return false;
    continueRequested = true;
    wake();
    return true;
  };
  const cancel = () => {
    cancelRequested = true;
    wake();
    return true;
  };
  try {
    onControl?.({ continueNow, cancel });
  } catch {
    /* 调用方的控制回调不该影响登录 */
  }

  /** 优雅停掉阶段 A 的 Chrome:先 SIGTERM 让它正常退出(会 flush cookie),超时再 SIGKILL。 */
  async function stopPhaseA() {
    if (!child || exited) return;
    try {
      child.kill('SIGTERM');
    } catch {
      /* 已退出 */
    }
    const softExited = await withTimeout(exitPromise, 5000, false);
    if (!softExited && !exited) {
      try {
        child.kill('SIGKILL');
      } catch {
        /* 已退出 */
      }
      await withTimeout(exitPromise, 2000, false);
    }
  }

  progress(
    'waiting-login',
    headlessPhaseA
      ? '（测试模式）等待阶段 A 结束…'
      : '请在 Chrome 窗口里完成登录（可以继续用 Google 登录），登录完成后点「我已完成登录，继续」，或按 ⌘Q 退出 Chrome'
  );

  // 等:用户点继续 / 用户退出 Chrome / 取消 / 超时
  while (Date.now() < deadline) {
    if (signal?.aborted || cancelRequested) break;
    if (exited || continueRequested) break;
    await new Promise((resolve) => {
      waiters.add(resolve);
      setTimeout(() => {
        waiters.delete(resolve);
        resolve();
      }, 400);
    });
  }

  if (signal?.aborted || cancelRequested) {
    progress('closing', '已取消登录，正在关闭 Chrome…');
    await stopPhaseA();
    return { status: 'closed', cookies: [], message: '登录已取消' };
  }

  const wasTimeout = !exited && !continueRequested;
  if (!exited) {
    progress('reading-session', '正在关闭登录窗口并读取登录态…');
    await stopPhaseA();
  } else if (exitCode !== null && exitCode !== 0) {
    // 非正常退出也继续尝试读 cookie,读不到再报原因
    progress('reading-session', `Chrome 已退出（code ${exitCode}），正在读取登录态…`);
  } else {
    progress('reading-session', 'Chrome 已退出，正在读取登录态…');
  }

  // 阶段 B:同 profile、headless、只读 cookie。给 Chrome 一点时间把 cookie 落盘。
  let lastCookies = [];
  const attempts = wasTimeout ? 2 : 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal?.aborted) return { status: 'closed', cookies: lastCookies, message: '登录已取消' };
    await sleep(attempt === 0 ? 500 : 1100, signal);
    let probe = null;
    try {
      probe = await startLogin({
        profileDir,
        loginUrl: null,
        headless: true,
        timeoutMs: attempt === attempts - 1 ? 7000 : 5000,
        signal,
      });
    } catch (error) {
      probe = { status: 'error', cookies: [], message: String(error?.message || error) };
    }
    const cookies = Array.isArray(probe?.cookies) ? probe.cookies : [];
    if (cookies.length) lastCookies = cookies;
    const auth = cookies.find((cookie) => cookie && cookie.name === '_auth');
    const sess = cookies.find((cookie) => cookie && cookie.name === '_pinterest_sess');
    if (auth && auth.value === '1' && sess && sess.value) {
      progress('cookies-found', '已读取 Pinterest 登录态，正在收尾…');
      return { status: 'success', cookies, message: '已登录 Pinterest，登录 Cookie 已捕获' };
    }
  }

  if (wasTimeout) {
    return {
      status: 'timeout',
      cookies: lastCookies,
      message: '等待登录超时。可以重试；如果已经登录，请确认点了「我已完成登录，继续」或按 ⌘Q 退出 Chrome',
    };
  }
  return {
    status: 'closed',
    cookies: lastCookies,
    message: stderrTail && !lastCookies.length
      ? `没有读到 Pinterest 登录态（Chrome 输出：${stderrTail.split('\n').slice(-2).join(' ').slice(-160)}）`
      : '没有读到 Pinterest 登录态。请确认在 Chrome 窗口里已经看到 Pinterest 首页，再点「我已完成登录，继续」',
  };
}

export default startLogin;
