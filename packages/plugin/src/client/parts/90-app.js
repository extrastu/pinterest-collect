/**
 * 面板装配:collection 数据、收藏动作、双栏布局、详情弹层、Toast,
 * 以及向主面板 / 侧边栏注册入口。
 */

const PC_WIDTH_KEY = 'pinterest-collect.leftWidth'

function pcReadStoredWidth() {
  try {
    const value = Number(window.localStorage.getItem(PC_WIDTH_KEY))
    if (value >= 260 && value <= 620) return value
  } catch {
    /* 隐私模式下拿不到 localStorage,忽略 */
  }
  return 320
}

function pcStoreWidth(value) {
  try {
    window.localStorage.setItem(PC_WIDTH_KEY, String(value))
  } catch {
    /* 同上 */
  }
}

class PcErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return h(
        'div',
        { className: 'pc-root' },
        h(
          'div',
          { className: 'pc-empty', role: 'alert' },
          h('strong', null, pcT('Pinterest 面板出错了')),
          h('span', null, String((this.state.error && this.state.error.message) || this.state.error)),
          h(
            'div',
            { className: 'pc-empty-actions' },
            h('button', { type: 'button', className: 'pc-btn', onClick: () => this.setState({ error: null }) }, pcT('重试'))
          )
        )
      )
    }
    return this.props.children
  }
}

function PinterestApp() {
  usePcLocaleRevision()
  const [page, setPage] = useState(null)
  const [collection, setCollection] = useState({ boards: [], pins: [], activeBoardId: 'all' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeBoardId, setActiveBoardId] = useState('all')
  const [query, setQuery] = useState('')
  const [openRequest, setOpenRequest] = useState(null)
  const [savingPinId, setSavingPinId] = useState('')
  const [toast, setToast] = useState(null)
  const [leftWidth, setLeftWidth] = useState(() => pcReadStoredWidth())
  const [dragging, setDragging] = useState(false)
  const toastTimer = useRef(0)
  const rootRef = useRef(null)
  const [atWindowEdge, setAtWindowEdge] = useState(false)
  const widthRef = useRef(leftWidth)
  const dragOrigin = useRef({ x: 0, width: 0 })

  widthRef.current = leftWidth

  const showToast = useCallback((message, tone) => {
    if (!message) return
    window.clearTimeout(toastTimer.current)
    setToast({ message: String(message), tone: tone === 'error' ? 'error' : 'ok' })
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current)
    },
    []
  )

  const loadCollection = useCallback(async () => {
    setError('')
    try {
      const data = await pcFetch('/collection')
      setCollection({
        boards: (data && data.boards) || [],
        pins: (data && data.pins) || [],
        activeBoardId: 'all'
      })
    } catch (error_) {
      setError((error_ && error_.message) || pcT('收藏夹加载失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCollection()
  }, [loadCollection])

  // 侧栏折叠后本面板会贴到窗口左上角,这时要让出 macOS 的红绿灯/侧栏把手区域。
  // 用面板自身的 rect 判断,侧栏展开/收起会改变面板宽度,ResizeObserver 会触发重新测量。
  React.useLayoutEffect(() => {
    const element = rootRef.current
    if (!element) return undefined
    function measure() {
      const rect = element.getBoundingClientRect()
      setAtWindowEdge(rect.left < 8)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const boards = Array.isArray(collection.boards) ? collection.boards : []
  const defaultBoardId = (boards.find(board => board.isDefault) || boards[0] || {}).id || PC_DEFAULT_BOARD

  const savedMap = useMemo(() => {
    const map = new Map()
    for (const pin of collection.pins || []) {
      if (pin && pin.id && !map.has(pin.id)) map.set(pin.id, pin.savedId)
    }
    return map
  }, [collection.pins])

  const savePin = useCallback(
    async (pin, boardId) => {
      if (!pin || !pin.id) return null
      const targetBoard = boardId || (activeBoardId !== 'all' ? activeBoardId : undefined)
      setSavingPinId(pin.id)
      try {
        const result = await pcFetch('/save', { pin, boardId: targetBoard })
        if (result && result.collection) setCollection(result.collection)
        const board = (result && result.saved && boards.find(item => item.id === result.saved.boardId)) || null
        showToast(
          result && result.duplicate
            ? pcT('这条 Pin 已经在收藏夹里了')
            : pcT('已收藏到「{board}」', { board: board ? board.title : pcT('我的收藏') })
        )
        return result
      } catch (error_) {
        showToast((error_ && error_.message) || pcT('收藏失败'), 'error')
        return null
      } finally {
        setSavingPinId('')
      }
    },
    [activeBoardId, boards, showToast]
  )

  const unsavePin = useCallback(
    async (savedId, pin) => {
      if (!savedId) return
      setSavingPinId((pin && pin.id) || '')
      try {
        const result = await pcFetch('/unsave', { savedId })
        if (result && result.collection) setCollection(result.collection)
        showToast(pcT('已从收藏夹移除'))
      } catch (error_) {
        showToast((error_ && error_.message) || pcT('取消收藏失败'), 'error')
      } finally {
        setSavingPinId('')
      }
    },
    [showToast]
  )

  const createBoard = useCallback(
    async title => {
      try {
        const result = await pcFetch('/collection/boards', { title })
        if (result && result.collection) setCollection(result.collection)
        if (result && result.board) {
          setActiveBoardId(result.board.id)
          showToast(pcT('已新建「{title}」', { title: result.board.title }))
        }
        return (result && result.board) || null
      } catch (error_) {
        showToast((error_ && error_.message) || pcT('新建收藏夹失败'), 'error')
        return null
      }
    },
    [showToast]
  )

  const renameBoard = useCallback(
    async (id, title) => {
      try {
        const result = await pcFetch('/collection/boards/rename', { id, title })
        if (result && result.collection) setCollection(result.collection)
        showToast(pcT('收藏夹已改名'))
        return (result && result.board) || null
      } catch (error_) {
        showToast((error_ && error_.message) || pcT('改名失败'), 'error')
        return null
      }
    },
    [showToast]
  )

  const removeBoard = useCallback(
    async id => {
      try {
        const result = await pcFetch('/collection/boards/remove', { id })
        if (result && result.collection) setCollection(result.collection)
        if (activeBoardId === id) setActiveBoardId('all')
        showToast(pcT('收藏夹已删除,里面的 Pin 已归入默认收藏夹'))
        return true
      } catch (error_) {
        showToast((error_ && error_.message) || pcT('删除收藏夹失败'), 'error')
        return false
      }
    },
    [activeBoardId, showToast]
  )

  // 左侧收藏点开一条 Pin:发出一次「请在右侧打开详情」的请求(带 token 以便重复点同一条也生效)
  const openDetail = useCallback(pin => {
    if (!pin) return
    setOpenRequest({ pin, token: `${pin.id}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}` })
  }, [])

  useEffect(() => {
    if (!dragging) return undefined
    function onMove(event) {
      const max = Math.max(280, Math.min(620, window.innerWidth - 420))
      const next = Math.min(Math.max(dragOrigin.current.width + (event.clientX - dragOrigin.current.x), 260), max)
      setLeftWidth(next)
    }
    function onUp() {
      setDragging(false)
      pcStoreWidth(widthRef.current)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging])

  function startDrag(event) {
    if (event.button !== undefined && event.button !== 0) return
    dragOrigin.current = { x: event.clientX, width: widthRef.current }
    setDragging(true)
    if (event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        /* 某些环境不支持捕获,忽略 */
      }
    }
  }

  function nudgeWidth(delta) {
    const next = Math.min(Math.max(widthRef.current + delta, 260), 620)
    setLeftWidth(next)
    pcStoreWidth(next)
  }

  return h(
    'div',
    {
      ref: rootRef,
      className: 'pc-root',
      'data-window-edge': atWindowEdge ? 'true' : 'false',
      style: { '--pc-left-width': `${leftWidth}px` }
    },
    h(
      'div',
      { className: 'pc-body' },
      h(
        'div',
        { className: 'pc-left' },
        h(CollectionPane, {
          collection,
          loading,
          error,
          query,
          onQueryChange: setQuery,
          activeBoardId,
          onSelectBoard: setActiveBoardId,
          onSave: savePin,
          onUnsave: unsavePin,
          onCreateBoard: createBoard,
          onRenameBoard: renameBoard,
          onRemoveBoard: removeBoard,
          onOpenPin: openDetail,
          onRetry: () => {
            setLoading(true)
            void loadCollection()
          },
          onToast: showToast
        })
      ),
      h('div', {
        className: 'pc-divider',
        role: 'separator',
        'aria-orientation': 'vertical',
        'aria-label': pcT('拖动调整收藏栏宽度'),
        'aria-valuenow': leftWidth,
        'aria-valuemin': 260,
        'aria-valuemax': 620,
        tabIndex: 0,
        'data-dragging': dragging ? 'true' : 'false',
        onPointerDown: startDrag,
        onKeyDown: event => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            nudgeWidth(-16)
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            nudgeWidth(16)
          }
        }
      }),
      h(
        'div',
        { className: 'pc-right' },
        h(BrowsePane, {
          savedMap,
          savingPinId,
          boards,
          defaultBoardId,
          openRequest,
          onSave: (pin, boardId) => {
            void savePin(pin, boardId)
          },
          onUnsave: (savedId, pin) => {
            void unsavePin(savedId, pin)
          },
          onOpenSettings: () => setPage('settings'),
          onOpenAccount: () => setPage('account'),
          page,
          onClosePage: () => setPage(null),
          onToast: showToast
        })
      )
    ),
    toast
      ? h(
          'div',
          { className: 'pc-toast', 'data-tone': toast.tone, role: 'status', 'aria-live': 'polite' },
          h('span', { className: 'pc-toast-dot', 'aria-hidden': true }),
          h('span', null, toast.message)
        )
      : null
  )
}

/** 侧边栏入口图标:书签丝带 + 心形,原创图形,不是 Pinterest 商标。 */
function PinterestSidebarIcon(props) {
  const size = (props && props.size) || 18
  const active = Boolean(props && props.active)
  return h(
    'span',
    {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: active ? 'var(--dsw-alias-brand-primary)' : 'inherit'
      }
    },
    h(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: 'false',
        style: { display: 'block' }
      },
      h('path', { d: 'M6.6 4.6h10.8a1.6 1.6 0 0 1 1.6 1.6v13.4L12 15.4l-7 4.2V6.2a1.6 1.6 0 0 1 1.6-1.6Z' }),
      h('path', { d: 'M12 13c-1.7-1.3-3.2-2.6-3.2-4.2 0-1.1.8-1.9 1.9-1.9.6 0 1.1.3 1.3.7.2-.4.7-.7 1.3-.7 1.1 0 1.9.8 1.9 1.9 0 1.6-1.5 2.9-3.2 4.2Z' })
    )
  )
}

function PinterestPanel() {
  return h(PcErrorBoundary, null, h(PinterestApp))
}

function pcStart(ctx) {
  const readService = name => {
    try {
      if (typeof ctx.get === 'function') return ctx.get(name)
    } catch {
      /* 忽略 */
    }
    return ctx[name]
  }
  const themeService = readService('theme')
  const localeService = readService('locale')
  pcBindServices({ theme: themeService, locale: localeService })
  if (localeService && typeof localeService.subscribe === 'function') {
    ctx.effect(() =>
      localeService.subscribe(() => {
        try {
          pcApplyLocaleSnapshot(localeService.getLocale())
        } catch {
          /* 忽略 */
        }
      })
    )
  }
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = PC_PLUGIN_ID
    style.textContent = PC_CSS
    document.head.appendChild(style)
    return () => {
      style.remove()
    }
  })
  ctx.slots.inject('main', () =>
    ctx.slots.register({ name: 'main', key: PC_PANEL_ID }, PinterestPanel)
  )
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      { name: 'sidebar.panellist', id: PC_PANEL_ID, order: 30, label: () => pcT('Pinterest 收藏') },
      PinterestSidebarIcon
    )
  )
}
