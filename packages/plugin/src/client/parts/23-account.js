/* eslint-disable */
/**
 * 账号页(占满右侧浏览区的一页,不是弹窗):
 *   - 当前登录的 Pinterest 用户:头像、名称、@用户名、Pin/画板数量
 *   - 他在 Pinterest 上 pin 的图(个人主页网格),支持无限滚动
 *   - 每张图都能收藏到左侧、点开看详情(详情页里还有更多类似)
 */

function PcAccountPage(props) {
  const { account, savedMap, savingPinId, onSave, onUnsave, onOpenPin, onBack, onToast } = props
  const viewer = (account && account.viewer) || null
  const username = viewer && viewer.username ? viewer.username : ''

  const [pins, setPins] = useState([])
  const [bookmark, setBookmark] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const scrollRef = useRef(null)
  const sentinelRef = useRef(null)
  const requestRef = useRef(0)
  const bookmarkRef = useRef(null)
  const busyRef = useRef(false)

  useEffect(() => {
    if (!account || !account.connected || !account.valid) {
      setStatus('auth')
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
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    async function load() {
      try {
        const data = await pcFetch('/account/pins?limit=24')
        if (!active || requestId !== requestRef.current) return
        setPins(Array.isArray(data && data.pins) ? data.pins : [])
        bookmarkRef.current = (data && data.bookmark) || null
        setBookmark((data && data.bookmark) || null)
        setStatus('ready')
      } catch (error_) {
        if (!active || requestId !== requestRef.current) return
        if (error_ && error_.status === 401) {
          setStatus('auth')
          setError((error_ && error_.message) || '需要重新登录 Pinterest')
        } else {
          setStatus('error')
          setError((error_ && error_.message) || '加载失败了')
        }
      } finally {
        if (requestId === requestRef.current) busyRef.current = false
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [account, reloadKey])

  const loadMore = useCallback(async () => {
    if (busyRef.current || !bookmarkRef.current) return
    const requestId = ++requestRef.current
    busyRef.current = true
    setStatus('more')
    setError('')
    try {
      const data = await pcFetch(`/account/pins?limit=24&bookmark=${encodeURIComponent(bookmarkRef.current)}`)
      if (requestId !== requestRef.current) return
      setPins(previous => {
        const seen = new Set(previous.map(pin => pin.id))
        const extra = (Array.isArray(data && data.pins) ? data.pins : []).filter(pin => pin && pin.id && !seen.has(pin.id))
        return previous.concat(extra)
      })
      bookmarkRef.current = (data && data.bookmark) || null
      setBookmark((data && data.bookmark) || null)
      setStatus('ready')
    } catch (error_) {
      if (requestId !== requestRef.current) return
      setStatus('ready')
      if (onToast) onToast((error_ && error_.message) || '继续加载失败', 'error')
    } finally {
      if (requestId === requestRef.current) busyRef.current = false
    }
  }, [onToast])

  useEffect(() => {
    const scroll = scrollRef.current
    const sentinel = sentinelRef.current
    if (!scroll || !sentinel || status !== 'ready' || !bookmark) return undefined
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) void loadMore()
      },
      { root: scroll, rootMargin: '600px 0px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [status, bookmark, loadMore])

  const profileHref = username ? `https://www.pinterest.com/${username}/` : 'https://www.pinterest.com/'
  const pinCount = viewer && typeof viewer.pinCount === 'number' ? viewer.pinCount : 0
  const boardCount = viewer && typeof viewer.boardCount === 'number' ? viewer.boardCount : 0

  const body = (() => {
    if (status === 'auth') {
      return h(
        'div',
        { className: 'pc-empty', role: 'alert' },
        h('strong', null, pcT('Pinterest 登录已失效')),
        h('span', null, error || pcT('重新登录后就能看到你在 Pinterest 上 pin 的图。')),
        h(
          'div',
          { className: 'pc-empty-actions' },
          h('button', { type: 'button', className: 'pc-btn', onClick: onBack }, pcIcon('arrowLeft', 13), h('span', null, pcT('返回')))
        )
      )
    }
    if (status === 'loading') {
      return h(
        'div',
        { className: 'pc-masonry', 'aria-hidden': true },
        [220, 180, 240, 196, 210, 236, 200, 224].map((height, index) =>
          h(
            'div',
            { key: index, className: 'pc-pin-card', style: { height }, 'aria-hidden': true },
            h('div', { className: 'pc-skeleton', style: { height: '100%', borderRadius: 16 } })
          )
        )
      )
    }
    if (status === 'error') {
      return h(
        'div',
        { className: 'pc-empty', role: 'alert' },
        h('strong', null, pcT('没加载出来')),
        h('span', null, error || pcT('网络或接口暂时不可用')),
        h(
          'div',
          { className: 'pc-empty-actions' },
          h(
            'button',
            { type: 'button', className: 'pc-btn', onClick: () => setReloadKey(key => key + 1) },
            pcIcon('refresh', 14),
            h('span', null, pcT('重试'))
          )
        )
      )
    }
    if (!pins.length) {
      return h(
        'div',
        { className: 'pc-empty' },
        h('strong', null, pcT('Pinterest 上还没有 Pin')),
        h('span', null, pcT('你在 Pinterest 上 pin 过的图会出现在这里。')),
        h(
          'div',
          { className: 'pc-empty-actions' },
          h('a', { className: 'pc-btn', href: profileHref, target: '_blank', rel: 'noreferrer noopener' }, pcIcon('external', 13), h('span', null, pcT('在 Pinterest 打开')))
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
          onOpen: onOpenPin
        })
      )
    )
  })()

  return h(
    'div',
    { className: 'pc-settings-page pc-account-page', role: 'region', 'aria-label': pcT('我的账号') },
    h(
      'div',
      { className: 'pc-settings-page-bar' },
      h(
        'button',
        {
          type: 'button',
          className: 'pc-icon-btn',
          onClick: onBack,
          title: pcT('返回'),
          'aria-label': pcT('返回')
        },
        pcIcon('arrowLeft', 16)
      ),
      h('span', { className: 'pc-settings-page-title' }, pcT('我的账号')),
      h('span', { style: { flex: 1 } }),
      h(
        'a',
        { className: 'pc-btn', href: profileHref, target: '_blank', rel: 'noreferrer noopener' },
        pcIcon('external', 13),
        h('span', null, pcT('在 Pinterest 打开'))
      )
    ),
    h(
      'div',
      { className: 'pc-settings-page-scroll pc-scroll', ref: scrollRef },
      h(
        'div',
        { className: 'pc-settings-wrap' },
        h(
          'div',
          { className: 'pc-account-hero' },
          h(PcAvatar, { src: viewer && viewer.avatar, name: (viewer && (viewer.name || viewer.username)) || 'Pinterest', size: 56 }),
          h(
            'div',
            { className: 'pc-account-hero-text' },
            h('strong', null, (viewer && (viewer.name || viewer.username)) || pcT('Pinterest 账号')),
            h('span', null, username ? `@${username}` : ''),
            h(
              'span',
              { className: 'pc-account-hero-meta' },
              pinCount || boardCount
                ? pcT('{pins} 个 Pin · {boards} 个画板', { pins: pinCount, boards: boardCount })
                : pcT('你的 Pinterest 账号')
            )
          )
        ),
        h(
          'div',
          { className: 'pc-account-grid-head' },
          h('h3', null, pcT('我的 Pin')),
          h('span', null, pcT('你在 Pinterest 上 pin 的图'))
        ),
        body,
        h('div', { ref: sentinelRef, className: 'pc-feed-sentinel', 'aria-hidden': true }),
        status === 'more'
          ? h('div', { className: 'pc-feed-status' }, pcIcon('spinner', 15), h('span', null, pcT('正在加载更多')))
          : status === 'ready' && pins.length > 0 && !bookmark
            ? h('div', { className: 'pc-feed-status' }, h('span', null, pcT('已经到底了')))
            : null
      )
    )
  )
}
