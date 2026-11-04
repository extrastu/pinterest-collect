/**
 * 右侧「Pinterest 浏览器」(webview 观感)。
 *
 * 两种内容源:
 *  - 推荐流 /feed:需要登录 Pinterest(个性化首页),登录后才可用;
 *  - 搜索 /search:不需要登录,地址栏输入关键词或粘贴 pinterest.com 链接。
 *
 * 没有任何「推荐分类」:未登录时这里只给登录引导 + 搜索入口。
 */

function pcDedupePins(list) {
  const seen = new Set()
  const output = []
  for (const pin of list || []) {
    if (!pin || !pin.id || seen.has(pin.id)) continue
    seen.add(pin.id)
    output.push(pin)
  }
  return output
}

function PcPinMedia(props) {
  const { pin } = props
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const aspect = pcAspect(pin)
  const mediaStyle = {
    aspectRatio: aspect,
    backgroundColor: pin.dominantColor || 'var(--pc-surface-2)'
  }
  if (!pin.image || failed) {
    return h(
      'div',
      { className: 'pc-pin-media', style: mediaStyle },
      h('div', { className: 'pc-pin-fallback' }, pcIcon('pin', 22))
    )
  }
  return h(
    'div',
    { className: 'pc-pin-media', style: mediaStyle },
    h('img', {
      src: pin.image,
      alt: pin.title || pin.description || 'Pinterest pin',
      loading: 'lazy',
      decoding: 'async',
      referrerPolicy: 'no-referrer',
      draggable: false,
      'data-loaded': loaded ? 'true' : 'false',
      onLoad: () => setLoaded(true),
      onError: () => setFailed(true)
    })
  )
}

/** 浏览流里的一张 Pin 卡片。 */
function PcPinCard(props) {
  const { pin, savedId, saving, onSave, onUnsave, onOpen } = props
  const saved = Boolean(savedId)
  const openDetail = () => onOpen && onOpen(pin)
  const handleToggle = event => {
    event.preventDefault()
    event.stopPropagation()
    if (saving) return
    if (saved) onUnsave && onUnsave(savedId, pin)
    else onSave && onSave(pin)
  }
  const stopAndOpen = event => {
    event.preventDefault()
    event.stopPropagation()
    openDetail()
  }
  return h(
    'div',
    {
      className: 'pc-pin-card',
      role: 'button',
      tabIndex: 0,
      'aria-label': pcT('查看 Pin:{title}', { title: pin.title || pin.description || pin.id }),
      onClick: openDetail,
      onKeyDown: event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openDetail()
        }
      }
    },
    h(
      'div',
      { style: { position: 'relative' } },
      h(PcPinMedia, { pin }),
      h(
        'div',
        { className: 'pc-pin-overlay' },
        h(
          'div',
          { className: 'pc-pin-overlay-top' },
          h(
            'button',
            {
              type: 'button',
              className: 'pc-save-pill',
              'data-saved': saved ? 'true' : 'false',
              'aria-label': saved ? pcT('取消收藏') : pcT('收藏到我的收藏'),
              'aria-pressed': saved ? 'true' : 'false',
              disabled: Boolean(saving),
              onClick: handleToggle
            },
            pcIcon(saved ? 'check' : 'heart', 13),
            h('span', null, saving ? pcT('保存中') : saved ? pcT('已收藏') : pcT('收藏'))
          )
        ),
        h(
          'div',
          { className: 'pc-pin-overlay-bottom' },
          h(
            'span',
            {
              className: 'pc-ellipsis',
              style: { flex: 1, minWidth: 0, color: '#fff', fontSize: 11, textShadow: '0 1px 3px rgba(0,0,0,.55)' }
            },
            (pin.board && pin.board.name) || (pin.pinner && pin.pinner.name) || ''
          ),
          h(
            'button',
            { type: 'button', className: 'pc-pin-open', 'aria-label': pcT('打开 Pin 详情'), onClick: stopAndOpen },
            pcIcon('external', 13)
          )
        )
      )
    ),
    h(
      'div',
      { className: 'pc-pin-caption' },
      h('div', { className: 'pc-pin-title' }, pin.title || pin.description || 'Pinterest Pin'),
      h(
        'div',
        { className: 'pc-pin-sub pc-ellipsis' },
        (pin.pinner && pin.pinner.name) || (pin.siteName ? pcT('来自 {site}', { site: pin.siteName }) : 'Pinterest')
      )
    )
  )
}

function PcFeedSkeleton() {
  const heights = [188, 240, 210, 268, 196, 232, 176, 252, 204, 224]
  return h(
    'div',
    { className: 'pc-masonry', 'aria-hidden': true },
    heights.map((height, index) =>
      h(
        'div',
        { key: index, className: 'pc-pin-card', style: { height, marginBottom: 12 }, 'aria-hidden': true },
        h('div', { className: 'pc-skeleton', style: { height: '100%', borderRadius: 16 } })
      )
    )
  )
}

function PcFeedNotice(props) {
  return h(
    'div',
    { className: 'pc-feed-notice' },
    h('span', { className: 'pc-alert-icon' }, pcIcon(props.icon || 'pin', 14)),
    h('span', { style: { flex: 1, minWidth: 0 } }, props.message),
    props.actionLabel
      ? h(
          'button',
          {
            type: 'button',
            className: 'pc-btn',
            onClick: props.onAction
          },
          props.actionLabel
        )
      : null
  )
}

/**
 * 右侧浏览面板:账号态、推荐流、搜索结果都在这里。
 * 收藏状态由 App 传入(savedMap),保存动作也由 App 发。
 */
function BrowsePane(props) {
  const { savedMap, savingPinId, onSave, onUnsave, onToast, boards, defaultBoardId, openRequest, onOpenSettings, onOpenAccount, page, onClosePage } = props

  const [account, setAccount] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [mode, setMode] = useState('feed')
  const [address, setAddress] = useState('')
  const [query, setQuery] = useState('')
  const [resolving, setResolving] = useState(false)
  const [pins, setPins] = useState([])
  const [bookmark, setBookmark] = useState(null)
  const [status, setStatus] = useState('boot')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [hostOutdated, setHostOutdated] = useState(false)
  const [closeupStack, setCloseupStack] = useState([])

  const feedRef = useRef(null)
  const sentinelRef = useRef(null)
  const requestRef = useRef(0)
  const bookmarkRef = useRef(null)
  const busyRef = useRef(false)
  const modeRef = useRef('feed')
  const queryRef = useRef('')

  modeRef.current = mode
  queryRef.current = query

  const refreshViewer = useCallback(async () => {
    try {
      const data = await pcFetch('/account/viewer')
      if (data && data.viewer) {
        setAccount(previous => (previous ? { ...previous, viewer: data.viewer } : previous))
      }
    } catch {
      /* 头像/昵称只是增强,失败不影响面板 */
    }
  }, [])

  const refreshAccount = useCallback(async () => {
    try {
      const data = await pcFetch('/account')
      setAccount(data || { connected: false, valid: false })
      if (data && data.connected && data.valid) void refreshViewer()
      return data
    } catch (error_) {
      setAccount({ connected: false, valid: false, chromeAvailable: false, message: (error_ && error_.message) || '' })
      return null
    }
  }, [refreshViewer])

  useEffect(() => {
    void refreshAccount()
  }, [refreshAccount])

  // 左侧收藏点开一条 Pin 时,App 通过 openRequest 把请求转进来
  useEffect(() => {
    if (!openRequest || !openRequest.pin) return
    setCloseupStack([openRequest.pin])
  }, [openRequest])

  useEffect(() => {
    let cancelled = false
    pcFetch('/health')
      .then(health => {
        if (cancelled) return
        // 旧一代 Host 没有 /account 与 /feed,提示用户重启 Harness 而不是弹一堆 404
        if (!health || !health.account) setHostOutdated(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const loggedIn = Boolean(account && account.connected && account.valid)
  const viewer = (account && account.viewer) || null
  const blocked = account !== null && !loggedIn

  // 首屏 / 换源 / 刷新
  useEffect(() => {
    if (!account) return undefined
    if (mode === 'feed' && blocked) {
      setStatus(account.connected ? 'auth' : 'disconnected')
      setPins([])
      setBookmark(null)
      return undefined
    }
    let active = true
    const requestId = ++requestRef.current
    busyRef.current = true
    setStatus('loading')
    setError('')
    setPins([])
    bookmarkRef.current = null
    setBookmark(null)
    async function load() {
      try {
        const pathname = mode === 'feed'
          ? '/feed?limit=24'
          : `/search?q=${encodeURIComponent(query)}&limit=24`
        const data = await pcFetch(pathname)
        if (!active || requestId !== requestRef.current) return
        setPins(pcDedupePins(data && data.pins))
        bookmarkRef.current = (data && data.bookmark) || null
        setBookmark((data && data.bookmark) || null)
        setStatus('ready')
      } catch (error_) {
        if (!active || requestId !== requestRef.current) return
        if (error_ && error_.status === 401) {
          setStatus('auth')
          setError((error_ && error_.message) || pcT('Pinterest 登录已失效'))
        } else {
          setStatus('error')
          setError((error_ && error_.message) || pcT('加载失败了'))
        }
      } finally {
        if (requestId === requestRef.current) busyRef.current = false
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [account, mode, query, reloadKey, blocked])

  const loadMore = useCallback(async () => {
    if (busyRef.current || !bookmarkRef.current) return
    const requestId = ++requestRef.current
    busyRef.current = true
    setStatus('more')
    setError('')
    try {
      const currentMode = modeRef.current
      const pathname = currentMode === 'feed'
        ? `/feed?limit=24&bookmark=${encodeURIComponent(bookmarkRef.current)}`
        : `/search?q=${encodeURIComponent(queryRef.current)}&limit=24&bookmark=${encodeURIComponent(bookmarkRef.current)}`
      const data = await pcFetch(pathname)
      if (requestId !== requestRef.current) return
      setPins(previous => pcDedupePins(previous.concat((data && data.pins) || [])))
      bookmarkRef.current = (data && data.bookmark) || null
      setBookmark((data && data.bookmark) || null)
      setStatus('ready')
    } catch (error_) {
      if (requestId !== requestRef.current) return
      if (error_ && error_.status === 401) {
        setStatus('auth')
        setError((error_ && error_.message) || pcT('Pinterest 登录已失效'))
      } else {
        setStatus('ready')
        setError((error_ && error_.message) || pcT('继续加载失败'))
      }
    } finally {
      if (requestId === requestRef.current) busyRef.current = false
    }
  }, [])

  useEffect(() => {
    const feed = feedRef.current
    const sentinel = sentinelRef.current
    if (!feed || !sentinel || status !== 'ready' || !bookmark) return undefined
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) void loadMore()
      },
      { root: feed, rootMargin: '700px 0px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [status, bookmark, loadMore])

  function scrollToTop() {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }

  function pushCloseup(pin) {
    if (!pin) return
    setCloseupStack(previous => (previous.length ? previous.concat(pin) : [pin]))
  }

  function popCloseup() {
    setCloseupStack(previous => previous.slice(0, -1))
  }

  function openLogin() {
    if (hostOutdated) {
      if (onToast) onToast(pcT('插件的 Host 还是旧版本,重启一次 DeepSeek Harness 后就能登录 Pinterest'))
      return
    }
    setLoginOpen(true)
  }

  async function commitSearch(rawValue) {
    const raw = String(rawValue === undefined ? address : rawValue).trim()
    if (!raw) {
      if (loggedIn) {
        setMode('feed')
        setQuery('')
        setAddress('')
        scrollToTop()
      }
      return
    }
    let nextQuery = raw
    if (pcIsLink(raw)) {
      setResolving(true)
      try {
        const resolved = await pcFetch(`/resolve?url=${encodeURIComponent(raw)}`)
        if (resolved && resolved.kind === 'pin') {
          setResolving(false)
          if (onToast) onToast(pcT('单条 Pin 链接要登录态才读得到,换成关键词浏览吧'))
          return
        }
        const base = resolved && resolved.value ? resolved.value : raw
        nextQuery = (resolved && resolved.kind === 'search' && resolved.value) || pcParseQuery(base) || ''
      } catch (error) {
        nextQuery = pcParseQuery(raw) || ''
      }
      setResolving(false)
    }
    nextQuery = String(nextQuery || '').trim()
    if (!nextQuery) {
      if (onToast) onToast(pcT('这个链接里没有可浏览的关键词,换个搜索试试'))
      return
    }
    setAddress(nextQuery)
    setQuery(nextQuery)
    setMode('search')
    scrollToTop()
  }

  function backToFeed() {
    setMode('feed')
    setQuery('')
    setAddress('')
    scrollToTop()
  }

  function retry() {
    if (status === 'auth') {
      void refreshAccount()
      setReloadKey(key => key + 1)
      return
    }
    if (status === 'error') setReloadKey(key => key + 1)
    else void loadMore()
  }

  async function verifyAccount() {
    try {
      const data = await pcFetch('/account/verify', {})
      await refreshAccount()
      if (data && data.valid) {
        if (onToast) onToast(pcT('推荐流已恢复'))
        setMode('feed')
        setQuery('')
        setAddress('')
        setReloadKey(key => key + 1)
      } else if (onToast) {
        onToast(pcT('还是读不到推荐,可能需要重新登录一次'), 'error')
      }
    } catch (error_) {
      if (onToast) onToast((error_ && error_.message) || pcT('重新校验失败'), 'error')
    }
  }

  async function handleLogout() {
    try {
      await pcFetch('/account/logout', {})
      if (onToast) onToast(pcT('已退出 Pinterest 登录'))
      await refreshAccount()
      setMode('feed')
      setQuery('')
      setAddress('')
    } catch (error_) {
      if (onToast) onToast((error_ && error_.message) || pcT('退出登录失败'), 'error')
    }
  }

  function onConnected() {
    setMode('feed')
    setQuery('')
    setAddress('')
    void refreshAccount()
  }

  const externalHref = mode === 'search'
    ? `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`
    : 'https://www.pinterest.com/'

  const feedBody = (() => {
    if (status === 'boot' || status === 'loading') return h(PcFeedSkeleton)
    if (status === 'disconnected') {
      if (hostOutdated) {
        return h(
          'div',
          { className: 'pc-empty pc-login-empty' },
          h('span', { className: 'pc-login-empty-icon' }, pcIcon('refresh', 26)),
          h('strong', null, pcT('登录与推荐需要重启一次 Harness')),
          h('span', null, pcT('插件的浏览器侧已经更新,但 Host 半的 JS 在进程内只加载一次。退出并重新打开 DeepSeek Harness 后,这里会出现「登录 Pinterest」和为你推荐的首页流。')),
          h(
            'div',
            { className: 'pc-empty-actions' },
            h(
              'button',
              { type: 'button', className: 'pc-btn', onClick: () => setReloadKey(key => key + 1) },
              pcIcon('refresh', 14),
              h('span', null, pcT('重新检查'))
            )
          ),
          h('span', { className: 'pc-login-empty-hint' }, pcT('现在仍然可以在上方地址栏搜索并收藏 Pin。'))
        )
      }
      return h(
        'div',
        { className: 'pc-empty pc-login-empty' },
        h('span', { className: 'pc-login-empty-icon' }, pcIcon('pin', 26)),
        h('strong', null, pcT('登录后,这里是你专属的推荐流')),
        h('span', null, pcT('Pinterest 的推荐依赖你的登录态。连接账号后,右侧会直接显示按你口味生成的首页推荐,而不是通用分类。')),
        h(
          'div',
          { className: 'pc-empty-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'pc-save-primary',
              onClick: openLogin
            },
            pcIcon('pin', 14),
            h('span', null, pcT('登录 Pinterest'))
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'pc-btn',
              onClick: () => {
                if (onToast) onToast(pcT('在上方地址栏输入关键词,不登录也可以搜索 Pinterest'))
              }
            },
            pcT('改用搜索')
          )
        ),
        h('span', { className: 'pc-login-empty-hint' }, account && account.chromeAvailable ? pcT('会用独立 Chrome 窗口登录,不会动你日常浏览器的登录状态。') : pcT('可以粘贴浏览器里的 cookie 完成连接。'))
      )
    }
    if (status === 'auth') {
      const stillLoggedIn = Boolean(account && account.connected)
      return h(
        'div',
        { className: 'pc-empty pc-login-empty', role: 'alert' },
        h('span', { className: 'pc-login-empty-icon' }, pcIcon('refresh', 26)),
        h('strong', null, stillLoggedIn ? pcT('已登录,但这次没读到推荐流') : pcT('Pinterest 登录已失效')),
        h(
          'span',
          null,
          error || (stillLoggedIn
            ? pcT('Pinterest 没返回推荐内容,可能是接口调整或临时风控。先点「重新校验」,不行再重新连接一次。')
            : pcT('Pinterest 让这次请求失效了,通常是登录过期或被风控。重新连接一次即可。'))
        ),
        h(
          'div',
          { className: 'pc-empty-actions' },
          stillLoggedIn
            ? h(
                'button',
                { type: 'button', className: 'pc-btn', onClick: () => { void verifyAccount() } },
                pcIcon('check', 14),
                h('span', null, pcT('重新校验'))
              )
            : null,
          h(
            'button',
            { type: 'button', className: stillLoggedIn ? 'pc-btn' : 'pc-save-primary', onClick: openLogin },
            pcIcon('pin', 14),
            h('span', null, stillLoggedIn ? pcT('重新连接') : pcT('重新连接'))
          ),
          h('button', { type: 'button', className: 'pc-btn', onClick: retry }, pcT('重试'))
        )
      )
    }
    if (status === 'error') {
      return h(
        'div',
        { className: 'pc-empty', role: 'alert' },
        h('strong', null, pcT('没连上 Pinterest')),
        h('span', null, error || pcT('网络或接口暂时不可用')),
        h(
          'div',
          { className: 'pc-empty-actions' },
          h('button', { type: 'button', className: 'pc-btn', onClick: retry }, pcIcon('refresh', 14), h('span', null, pcT('重试'))),
          h('button', { type: 'button', className: 'pc-btn', onClick: openLogin }, pcT('账号设置'))
        )
      )
    }
    if (!pins.length) {
      return h(
        'div',
        { className: 'pc-empty' },
        h('strong', null, mode === 'search' ? pcT('没有找到相关 Pin') : pcT('推荐流暂时是空的')),
        h('span', null, mode === 'search' ? pcT('换一个关键词试试,或者返回你的推荐流。') : pcT('Pinterest 这会儿没给内容,过一会儿点刷新再看看。')),
        h(
          'div',
          { className: 'pc-empty-actions' },
          mode === 'search' && loggedIn
            ? h('button', { type: 'button', className: 'pc-btn', onClick: backToFeed }, pcT('返回推荐'))
            : null,
          h('button', { type: 'button', className: 'pc-btn', onClick: retry }, pcIcon('refresh', 14), h('span', null, pcT('刷新')))
        )
      )
    }
    return h(
      'div',
      { className: 'pc-masonry' },
      pins.map(pin =>
        h(PcPinCard, {
          key: pin.id,
          pin,
          savedId: savedMap ? savedMap.get(pin.id) : undefined,
          saving: savingPinId === pin.id,
          onSave,
          onUnsave,
          onOpen: pushCloseup
        })
      )
    )
  })()

  return h(
    'div',
    { className: 'pc-browser' },
    h(
      'div',
      { className: 'pc-webview-chrome' },
      h(
        'form',
        { className: 'pc-address', onSubmit: event => { event.preventDefault(); void commitSearch(address) }, role: 'search' },
        pcIcon('pin', 14),
        h('input', {
          type: 'search',
          value: address,
          placeholder: mode === 'feed' && loggedIn ? pcT('搜索 Pinterest,或直接回车回到推荐') : pcT('搜索 Pinterest,或粘贴 pinterest.com 链接'),
          'aria-label': pcT('Pinterest 地址栏'),
          spellCheck: false,
          onChange: event => setAddress(event.target.value),
          onKeyDown: event => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setAddress(mode === 'search' ? query : '')
              event.currentTarget.blur()
            }
          }
        }),
        resolving
          ? h('span', { className: 'pc-address-tag' }, pcIcon('spinner', 11), h('span', null, pcT('解析')))
          : h('span', { className: 'pc-address-tag' }, loggedIn ? pcT('已登录') : pcT('未登录'))
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'pc-icon-btn',
          title: pcT('执行搜索'),
          'aria-label': pcT('执行搜索'),
          disabled: resolving,
          onClick: () => {
            void commitSearch(address)
          }
        },
        pcIcon('search', 15)
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'pc-icon-btn',
          title: mode === 'search' ? pcT('换一批搜索结果') : pcT('刷新推荐'),
          'aria-label': mode === 'search' ? pcT('换一批搜索结果') : pcT('刷新推荐'),
          onClick: () => setReloadKey(key => key + 1)
        },
        pcIcon('refresh', 15)
      ),
      h(
        'a',
        {
          className: 'pc-icon-btn',
          href: externalHref,
          target: '_blank',
          rel: 'noreferrer noopener',
          title: pcT('在 Pinterest 官网打开'),
          'aria-label': pcT('在 Pinterest 官网打开')
        },
        pcIcon('external', 15)
      )
    ),
    h(
      'div',
      { className: 'pc-account-bar' },
      loggedIn && viewer
        ? h(
            'button',
            {
              type: 'button',
              className: 'pc-account-identity',
              title: pcT('我的账号'),
              'aria-label': pcT('我的账号'),
              onClick: () => {
                if (onOpenAccount) onOpenAccount()
              }
            },
            h(PcAvatar, { src: viewer.avatar, name: viewer.name || viewer.username || 'Pinterest', size: 22 }),
            h('span', { className: 'pc-account-name pc-ellipsis' }, viewer.name || viewer.username)
          )
        : h('span', { className: 'pc-account-dot', 'data-on': loggedIn ? 'true' : 'false', 'aria-hidden': true }),
      h(
        'span',
        { className: 'pc-account-text pc-ellipsis' },
        loggedIn
          ? viewer
            ? mode === 'search'
              ? pcT('搜索「{query}」· 按你的画像排序', { query: query })
              : pcT('推荐按你的口味生成')
            : mode === 'search'
              ? pcT('搜索「{query}」· 已登录,结果按你的画像排序', { query: query })
              : pcT('已连接 Pinterest · 推荐按你的口味生成')
          : hostOutdated
            ? pcT('Host 需要重启一次 Harness 才能登录 Pinterest')
            : account && account.connected
              ? pcT('Pinterest 登录已过期,重新连接后推荐会恢复')
              : pcT('未登录 · 登录后这里是你专属的推荐流')
      ),
      loggedIn && mode === 'search'
        ? h('button', { type: 'button', className: 'pc-chip', 'data-soft': 'true', onClick: backToFeed }, pcIcon('arrowLeft', 12), pcT('推荐'))
        : null,
      loggedIn
        ? null
        : h(
            'button',
            { type: 'button', className: 'pc-chip', 'data-soft': 'true', onClick: openLogin },
            pcIcon('pin', 12),
            pcT('登录')
          ),
      h(
        'button',
        {
          type: 'button',
          className: 'pc-icon-btn',
          title: pcT('设置'),
          'aria-label': pcT('设置'),
          onClick: () => {
            if (onOpenSettings) onOpenSettings()
          }
        },
        pcIcon('settings', 14)
      )
    ),
    h(
      'div',
      { className: 'pc-stage' },
      h(
        'div',
        { className: 'pc-feed-layer', 'data-covered': closeupStack.length ? 'true' : 'false', 'aria-hidden': closeupStack.length ? 'true' : undefined },
        h(
          'div',
          { className: 'pc-feed pc-scroll', ref: feedRef },
      mode === 'search' && loggedIn && pins.length
        ? h(
            'div',
            { className: 'pc-feed-mode' },
            h('button', { type: 'button', className: 'pc-chip', 'data-soft': 'true', onClick: backToFeed }, pcIcon('arrowLeft', 12), pcT('返回推荐')),
            h('span', { className: 'pc-feed-mode-query pc-ellipsis' }, pcT('搜索「{query}」', { query: query }))
          )
        : null,
      feedBody,
      error && pins.length > 0
        ? h(PcFeedNotice, { icon: 'refresh', message: error, actionLabel: pcT('重试'), onAction: retry })
        : null,
      h('div', { ref: sentinelRef, className: 'pc-feed-sentinel', 'aria-hidden': true }),
      status === 'more'
        ? h('div', { className: 'pc-feed-status' }, pcIcon('spinner', 15), h('span', null, pcT('正在加载更多 Pin')))
        : status === 'ready' && pins.length > 0 && !bookmark
          ? h(
              'div',
              { className: 'pc-feed-status' },
              h('span', null, mode === 'search' ? pcT('已经到底了 · 换个关键词继续逛') : pcT('推荐到头了 · 点右上角刷新换一批'))
            )
          : null
        )
      ),
      closeupStack.length
        ? h(PinCloseUp, {
            pin: closeupStack[closeupStack.length - 1],
            stackDepth: closeupStack.length,
            boards,
            savedMap,
            savingPinId,
            defaultBoardId,
            onSave,
            onUnsave,
            onBack: popCloseup,
            onOpenPin: pushCloseup,
            onToast
          })
        : null
    ),
    page === 'settings'
      ? h(PcSettingsPage, {
          onBack: onClosePage,
          onToast,
          account,
          onLogout: handleLogout,
          onOpenAccount,
          onOpenLogin: () => {
            if (onClosePage) onClosePage()
            openLogin()
          }
        })
      : null,
    page === 'account'
      ? h(PcAccountPage, {
          account,
          savedMap,
          savingPinId,
          onSave,
          onUnsave,
          onBack: onClosePage,
          onOpenPin: pin => {
            if (onClosePage) onClosePage()
            pushCloseup(pin)
          },
          onToast
        })
      : null,
    loginOpen
      ? h(PcLoginDialog, {
          account,
          onClose: () => setLoginOpen(false),
          onConnected,
          onLogout: handleLogout,
          onToast
        })
      : null
  )
}
