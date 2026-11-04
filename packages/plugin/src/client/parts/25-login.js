/**
 * 连接 Pinterest 账号的弹层。
 *
 * 两条路径:
 *  1. 一键:Host 打开一个独立 Chrome 窗口,用户在窗口里自己登录(验证码/2FA/第三方登录都由 Chrome
 *     处理),Host 通过 CDP 读取登录 cookie 后自动关闭窗口。
 *  2. 手动:用户从自己浏览器的 DevTools 复制 cookie 粘贴进来,Host 校验 `_auth=1` 后保存。
 *
 * 弹层本身不发任何第三方请求,只和同源 /pinterest-api 通信;cookie 只落在本机 session.json。
 */

function PcLoginDialog(props) {
  const { account, onClose, onConnected, onLogout, onToast } = props
  const chromeAvailable = Boolean(account && account.chromeAvailable)
  const [tab, setTab] = useState(chromeAvailable ? 'chrome' : 'manual')
  const [jobId, setJobId] = useState('')
  const [job, setJob] = useState(null)
  const [cookieText, setCookieText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const callbacks = useRef({})
  callbacks.current = { onClose, onConnected, onLogout, onToast }

  // 登录任务轮询
  useEffect(() => {
    if (!jobId) return undefined
    let cancelled = false
    let timer = 0
    async function poll() {
      try {
        const data = await pcFetch(`/account/login/status?jobId=${encodeURIComponent(jobId)}`)
        if (cancelled) return
        setJob(data)
        if (data && data.done) {
          window.clearInterval(timer)
          setJobId('')
          if (data.state === 'success') {
            if (callbacks.current.onToast) callbacks.current.onToast(pcT('已连接 Pinterest,推荐已就绪'))
            if (callbacks.current.onConnected) callbacks.current.onConnected()
            if (callbacks.current.onClose) callbacks.current.onClose()
          } else {
            setError((data && data.message) || pcT('登录没有完成,可以再试一次'))
          }
        }
      } catch (error_) {
        if (cancelled) return
        window.clearInterval(timer)
        setJobId('')
        setError((error_ && error_.message) || pcT('查询登录状态失败'))
      }
    }
    void poll()
    timer = window.setInterval(() => {
      void poll()
    }, 1500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [jobId])

  // 关闭弹层时如果还有登录任务,取消它,避免留下一个 Chrome 窗口
  useEffect(
    () => () => {
      const active = jobId
      if (!active) return
      try {
        void pcFetch('/account/login/cancel', { jobId: active }).catch(() => {})
      } catch {
        /* 忽略 */
      }
    },
    [jobId]
  )

  async function startChromeLogin() {
    setError('')
    setBusy(true)
    try {
      const data = await pcFetch('/account/login/start', {})
      setJob({ state: data.state, message: data.message, done: false })
      setJobId(data.jobId)
    } catch (error_) {
      setError((error_ && error_.message) || pcT('打不开 Chrome 登录窗口'))
      if (error_ && error_.status === 409) setTab('manual')
    } finally {
      setBusy(false)
    }
  }

  async function cancelLogin() {
    const active = jobId
    setJobId('')
    setJob(null)
    setError('')
    if (!active) return
    try {
      await pcFetch('/account/login/cancel', { jobId: active })
    } catch {
      /* 忽略 */
    }
  }

  async function continueLogin() {
    const active = jobId
    if (!active) return
    setError('')
    setBusy(true)
    try {
      const data = await pcFetch('/account/login/continue', { jobId: active })
      if (data && data.ok) {
        setJob(previous => ({ ...(previous || {}), message: pcT('正在读取登录态…') }))
      }
    } catch (error_) {
      setError((error_ && error_.message) || pcT('继续失败,请重试'))
    } finally {
      setBusy(false)
    }
  }

  async function submitCookies() {
    const text = String(cookieText || '').trim()
    if (!text) {
      setError(pcT('先把 cookie 粘贴进来'))
      return
    }
    setError('')
    setBusy(true)
    try {
      await pcFetch('/account/cookies', { cookieString: text })
      if (callbacks.current.onToast) callbacks.current.onToast(pcT('已连接 Pinterest 账号'))
      if (callbacks.current.onConnected) callbacks.current.onConnected()
      if (callbacks.current.onClose) callbacks.current.onClose()
    } catch (error_) {
      setError((error_ && error_.message) || pcT('Cookie 校验没有通过'))
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    setError('')
    try {
      await pcFetch('/account/logout', {})
      if (callbacks.current.onToast) callbacks.current.onToast(pcT('已退出 Pinterest 登录'))
      if (callbacks.current.onLogout) callbacks.current.onLogout()
      if (callbacks.current.onClose) callbacks.current.onClose()
    } catch (error_) {
      setError((error_ && error_.message) || pcT('退出登录失败'))
    } finally {
      setBusy(false)
    }
  }

  const loggedIn = Boolean(account && account.connected && account.valid)
  const chromeTab = h(
    'div',
    { className: 'pc-login-pane', style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    h(
      'p',
      { className: 'pc-login-lead' },
      pcT('点下面的按钮会打开一个独立的 Chrome 窗口,在里面正常登录 Pinterest(继续用 Google 登录也可以:这个窗口不带调试端口,Google 不会判成不安全浏览器)。登录完成、看到 Pinterest 首页后,点下面的「我已完成登录,继续」;或者直接按 ⌘Q 退出那个 Chrome 窗口,插件都会自动读取登录态。')
    ),
    chromeAvailable
      ? null
      : h(
          'div',
          { className: 'pc-alert', 'data-tone': 'error' },
          h('span', { className: 'pc-alert-icon' }, pcIcon('pin', 14)),
          h('span', { style: { flex: 1 } }, pcT('这台机器上没有找到 Chrome,请用右边的「粘贴 Cookie」方式连接。'))
        ),
    h(
      'div',
      { className: 'pc-login-actions' },
      jobId
        ? h(
            'button',
            {
              type: 'button',
              className: 'pc-save-primary',
              disabled: busy,
              onClick: () => {
                void continueLogin()
              }
            },
            pcIcon('check', 14),
            h('span', null, busy ? pcT('处理中…') : pcT('我已完成登录,继续'))
          )
        : h(
            'button',
            {
              type: 'button',
              className: 'pc-save-primary',
              disabled: busy || !chromeAvailable,
              onClick: () => {
                void startChromeLogin()
              }
            },
            pcIcon('external', 14),
            h('span', null, pcT('打开 Chrome 登录窗口'))
          ),
      jobId
        ? h(
            'button',
            {
              type: 'button',
              className: 'pc-btn',
              onClick: () => {
                void cancelLogin()
              }
            },
            pcT('取消')
          )
        : null
    ),
    jobId
      ? h(
          'div',
          { className: 'pc-login-status', role: 'status', 'aria-live': 'polite' },
          pcIcon('spinner', 15),
          h(
            'div',
            { style: { flex: 1, minWidth: 0 } },
            h('strong', null, (job && job.state === 'reading-session') ? pcT('正在读取登录态…') : pcT('请在 Chrome 窗口里完成登录')),
            h('span', { className: 'pc-login-status-msg' }, (job && job.message) || pcT('登录完成后点「我已完成登录,继续」或按 ⌘Q 退出 Chrome'))
          )
        )
      : null,
    h(
      'p',
      { className: 'pc-login-note' },
      pcT('登录窗口用的是独立 Chrome 配置(不会碰你日常浏览器的登录状态),并且**不开调试端口**——带调试端口的新版 Chrome 会把 navigator.webdriver 置为 true,Google 会因此拒绝登录。读取 cookie 是等你关掉窗口后用一个 headless 实例单独完成的,不会碰 Google 页面。登录后的 cookie 只保存在本机,插件不会读取或上传你的账号密码。')
    )
  )

  const manualTab = h(
    'div',
    { className: 'pc-login-pane', style: { display: 'flex', flexDirection: 'column', gap: 10 } },
    h(
      'ol',
      { className: 'pc-login-steps' },
      h('li', null, pcT('在浏览器里打开 pinterest.com 并登录。')),
      h('li', null, pcT('按 F12 打开开发者工具 → Application(应用) → Cookies → https://www.pinterest.com。')),
      h('li', null, pcT('找到 `_pinterest_sess`、`csrftoken`、`_auth` 三个值,拼成一行:`_pinterest_sess=…; csrftoken=…; _auth=1`。')),
      h('li', null, pcT('粘贴到下面,点「验证并保存」。'))
    ),
    h('textarea', {
      className: 'pc-input pc-login-textarea',
      placeholder: '_pinterest_sess=…; csrftoken=…; _auth=1',
      value: cookieText,
      spellCheck: false,
      rows: 4,
      'aria-label': pcT('粘贴 Pinterest cookie'),
      onChange: event => setCookieText(event.target.value)
    }),
    h(
      'div',
      { className: 'pc-login-actions' },
      h(
        'button',
        {
          type: 'button',
          className: 'pc-save-primary',
          disabled: busy || !cookieText.trim(),
          onClick: () => {
            void submitCookies()
          }
        },
        pcIcon('check', 14),
        h('span', null, busy ? pcT('校验中…') : pcT('验证并保存'))
      )
    ),
    h(
      'p',
      { className: 'pc-login-note' },
      pcT('Cookie 等同于登录凭证:它只会写入本机 ~/.dsh/pinterest-collect/session.json(权限 600),用于读取你自己的推荐流;插件不会把它发到 Pinterest 以外的任何地方,随时可以在这里退出登录。')
    )
  )

  return h(
    'div',
    {
      className: 'pc-detail-backdrop',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': pcT('连接 Pinterest 账号'),
      onMouseDown: event => {
        if (event.target === event.currentTarget && callbacks.current.onClose) callbacks.current.onClose()
      }
    },
    h(
      'div',
      { className: 'pc-login-card' },
      h(
        'div',
        { className: 'pc-login-head' },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } },
          h('span', { className: 'pc-login-badge', 'aria-hidden': true }, pcIcon('pin', 15)),
          h('h2', { className: 'pc-login-title' }, loggedIn ? pcT('Pinterest 账号') : pcT('连接 Pinterest 账号'))
        ),
        h(
          'button',
          { type: 'button', className: 'pc-icon-btn', 'aria-label': pcT('关闭'), onClick: () => callbacks.current.onClose && callbacks.current.onClose() },
          pcIcon('close', 16)
        )
      ),
      loggedIn
        ? h(
            'div',
            { className: 'pc-login-pane', style: { display: 'flex', flexDirection: 'column', gap: 12 } },
            h(
              'div',
              { className: 'pc-login-status', role: 'status' },
              h(PcAvatar, {
                src: account && account.viewer && account.viewer.avatar,
                name: (account && account.viewer && (account.viewer.name || account.viewer.username)) || 'Pinterest',
                size: 34
              }),
              h(
                'div',
                { style: { flex: 1, minWidth: 0 } },
                h(
                  'strong',
                  null,
                  (account && account.viewer && (account.viewer.name || account.viewer.username)) || pcT('已连接 Pinterest')
                ),
                h(
                  'span',
                  { className: 'pc-login-status-msg' },
                  account && account.viewer && account.viewer.username
                    ? `@${account.viewer.username}`
                    : account && account.updatedAt
                      ? pcT('登录时间 {time} · 推荐流可用', { time: pcTimeAgo(account.updatedAt) })
                      : pcT('推荐流可用')
                )
              )
            ),
            h(
              'div',
              { className: 'pc-login-actions' },
              h(
                'button',
                { type: 'button', className: 'pc-btn', disabled: busy, onClick: () => { void logout() } },
                pcIcon('close', 13),
                h('span', null, pcT('退出登录'))
              )
            ),
            h('p', { className: 'pc-login-note' }, pcT('退出只会删除本机保存的 cookie,不会影响你浏览器里的 Pinterest 登录。'))
          )
        : h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            h(
              'div',
              { className: 'pc-login-tabs', role: 'tablist', 'aria-label': pcT('连接方式') },
              h(
                'button',
                { type: 'button', role: 'tab', className: 'pc-chip', 'aria-pressed': tab === 'chrome' ? 'true' : 'false', onClick: () => setTab('chrome') },
                pcT('一键登录')
              ),
              h(
                'button',
                { type: 'button', role: 'tab', className: 'pc-chip', 'aria-pressed': tab === 'manual' ? 'true' : 'false', onClick: () => setTab('manual') },
                pcT('粘贴 Cookie')
              )
            ),
            tab === 'chrome' ? chromeTab : manualTab,
            error
              ? h(
                  'div',
                  { className: 'pc-alert pc-login-error', 'data-tone': 'error', role: 'alert' },
                  h('span', { className: 'pc-alert-icon' }, pcIcon('refresh', 14)),
                  h('span', { style: { flex: 1 } }, error)
                )
              : null,
            h(
              'p',
              { className: 'pc-login-foot' },
              pcT('Pinterest 不提供免登录的个性化推荐接口,所以推荐流必须用你的登录态读取;登录态只用于读取你自己的首页流。')
            )
          )
    )
  )
}
