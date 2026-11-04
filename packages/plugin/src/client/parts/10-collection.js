/* eslint-disable */
/**
 * 左侧收藏面板（CollectionPane）
 *
 * 这是拼进客户端同一个 factory 作用域的纯 JS 片段：
 * 只用共享作用域里的 h / useState / useEffect / useMemo / useRef /
 * pcIcon / pcTimeAgo / pcAspect；不写 JSX、模块语法、全局状态。
 * 颜色只用 --dsw-alias-* 主题 token，class 一律 pc- 前缀。
 */

/** 安全地调用上层传进来的回调（未提供时静默跳过）。 */
function collectionCall(callback, ...args) {
  if (typeof callback !== 'function') return
  callback(...args)
}

/** savedAt -> 时间戳；非法值按 0 处理，保证排序稳定。 */
function collectionTimeValue(value) {
  if (!value) return 0
  const stamp = new Date(value).getTime()
  return Number.isFinite(stamp) ? stamp : 0
}

/** 新建 / 重命名收藏夹的小弹层。
 * Electron 里 window.prompt 不可用（点了没反应），所以自带一个输入框。 */
function CollectionNameDialog(props) {
  const { mode, initialValue, onCancel, onSubmit } = props
  const [value, setValue] = useState(initialValue || '')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(
    function () {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    },
    []
  )

  function submit(event) {
    if (event) event.preventDefault()
    const title = String(value || '').trim()
    if (!title) {
      setError(pcT('收藏夹名称不能为空'))
      return
    }
    collectionCall(onSubmit, title)
  }

  const rename = mode === 'rename'
  return h(
    'div',
    {
      className: 'pc-detail-backdrop',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': rename ? pcT('重命名收藏夹') : pcT('新建收藏夹'),
      onMouseDown: function (event) {
        if (event.target === event.currentTarget) collectionCall(onCancel)
      }
    },
    h(
      'form',
      { className: 'pc-name-dialog', onSubmit: submit },
      h('h2', { className: 'pc-name-dialog-title' }, rename ? pcT('重命名收藏夹') : pcT('新建收藏夹')),
      h('input', {
        ref: inputRef,
        className: 'pc-input',
        type: 'text',
        value: value,
        maxLength: 40,
        placeholder: pcT('收藏夹名称'),
        'aria-label': pcT('收藏夹名称'),
        autoComplete: 'off',
        onChange: function (event) {
          setValue(event.target.value)
          setError('')
        },
        onKeyDown: function (event) {
          if (event.key !== 'Escape') return
          event.preventDefault()
          collectionCall(onCancel)
        }
      }),
      error ? h('p', { className: 'pc-name-dialog-error', role: 'alert' }, error) : null,
      h(
        'div',
        { className: 'pc-name-dialog-actions' },
        h(
          'button',
          { type: 'button', className: 'pc-btn', onClick: function () { collectionCall(onCancel) } },
          pcT('取消')
        ),
        h(
          'button',
          { type: 'submit', className: 'pc-save-primary' },
          pcIcon('check', 13),
          h('span', null, rename ? pcT('保存') : pcT('创建'))
        )
      )
    )
  )
}

/** 面板里的小图标按钮，复用 panel.css 的 .pc-icon-btn。 */
function CollectionIconButton(props) {
  const size = props.size || 28
  return h(
    'button',
    {
      type: 'button',
      className: 'pc-icon-btn' + (props.className ? ' ' + props.className : ''),
      'aria-label': props.label,
      title: props.title || props.label,
      'aria-expanded': typeof props.expanded === 'boolean' ? props.expanded : undefined,
      onClick: props.onClick,
      style: Object.assign(
        {
          width: size,
          height: size,
          borderRadius: props.radius || 8,
          boxSizing: 'border-box'
        },
        props.style
      )
    },
    pcIcon(props.icon, props.iconSize || Math.round(size * 0.52))
  )
}

/** 收藏夹 chips 行里的一个胶囊 + 「更多」菜单触发器。 */
function CollectionBoardChip(props) {
  const board = props.board || {}
  const label = board.title || pcT('未命名收藏夹')
  const count = props.count || 0
  const active = !!props.active
  const activeStyle = active
    ? {
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        border: '1px solid var(--dsw-alias-border-l2)',
        fontWeight: 600
      }
    : undefined
  function select() {
    collectionCall(props.onSelect, board.id)
  }
  function openFromContext(event) {
    event.preventDefault()
    collectionCall(props.onMenu, event, board)
  }
  return h(
    'div',
    {
      className: 'pc-collection-chip',
      style: { display: 'inline-flex', alignItems: 'center', gap: 2, flex: '0 0 auto' }
    },
    h(
      'button',
      {
        type: 'button',
        className: 'pc-chip pc-collection-chip-select',
        'aria-pressed': active,
        'aria-label': pcT('{name}，{count} 个收藏', { name: label, count: count }),
        title: label,
        onClick: select,
        onContextMenu: props.onMenu ? openFromContext : undefined,
        style: Object.assign({ boxSizing: 'border-box' }, activeStyle)
      },
      h('span', { className: 'pc-ellipsis', style: { maxWidth: 120 } }, label),
      h(
        'span',
        {
          className: 'pc-collection-chip-count',
          style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', fontVariantNumeric: 'tabular-nums' }
        },
        String(count)
      )
    ),
    props.onMenu
      ? h(CollectionIconButton, {
          icon: 'more',
          label: pcT('收藏夹「{name}」更多操作', { name: label }),
          title: pcT('更多操作'),
          size: 20,
          iconSize: 13,
          radius: 999,
          expanded: !!props.menuOpen,
          onClick: function (event) {
            collectionCall(props.onMenu, event, board)
          }
        })
      : null
  )
}

/** 一张已收藏的 Pin 卡片：hover / 键盘聚焦才浮现操作按钮。 */
function CollectionPinCard(props) {
  const pin = props.pin || {}
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [broken, setBroken] = useState(!pin.image)
  const actionsVisible = hovered || focused
  const title = pin.title || pin.siteName || pcT('未命名收藏')
  const metaParts = []
  if (props.showBoard) {
    const boardTitle = props.boardTitle || (pin.board && pin.board.name) || ''
    if (boardTitle) metaParts.push(boardTitle)
  }
  if (pin.savedAt) {
    const ago = pcTimeAgo(pin.savedAt)
    if (ago) metaParts.push(ago)
  }
  const meta = metaParts.join(' · ')

  function open() {
    collectionCall(props.onOpen, pin)
  }
  function unsave(event) {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    collectionCall(props.onUnsave, pin.savedId)
  }
  function handleKeyDown(event) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      open()
    }
  }
  function handleBlur(event) {
    const next = event.relatedTarget
    if (next && event.currentTarget.contains(next)) return
    setFocused(false)
  }

  const media = h(
    'div',
    {
      className: 'pc-pin-media pc-collection-pin-media',
      style: {
        position: 'relative',
        width: '100%',
        aspectRatio: pcAspect(pin),
        overflow: 'hidden',
        borderRadius: 10,
        border: '1px solid ' + (hovered ? 'var(--dsw-alias-border-l2)' : 'var(--dsw-alias-border-l1)'),
        background: 'var(--dsw-alias-bg-layer-2)',
        boxSizing: 'border-box'
      }
    },
    broken || !pin.image
      ? h('div', { className: 'pc-pin-fallback pc-collection-pin-fallback' }, pcIcon('pin', 20))
      : h('img', {
          src: pin.imageLarge || pin.image,
          alt: '',
          loading: 'lazy',
          draggable: false,
          onError: function () {
            setBroken(true)
          },
          style: {
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 1
          }
        }),
    pin.isVideo
      ? h(
          'span',
          {
            className: 'pc-collection-pin-video',
            style: {
              position: 'absolute',
              left: 6,
              top: 6,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'var(--dsw-alias-bg-overlay)',
              color: 'var(--dsw-alias-label-primary)',
              fontSize: 11,
              lineHeight: 1.5
            }
          },
          pcT('视频')
        )
      : null,
    h(
      'div',
      {
        className: 'pc-pin-overlay pc-collection-pin-actions',
        style: {
          opacity: actionsVisible ? 1 : 0,
          pointerEvents: actionsVisible ? 'auto' : 'none',
          transition: 'opacity 0.16s ease'
        }
      },
      h(
        'div',
        { className: 'pc-pin-overlay-top' },
        h(
          'button',
          {
            type: 'button',
            className: 'pc-pin-open',
            'aria-label': pcT('打开收藏详情'),
            title: pcT('打开'),
            onClick: function (event) {
              event.stopPropagation()
              open()
            }
          },
          pcIcon('external', 14)
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'pc-pin-open',
            'aria-label': pcT('取消收藏'),
            title: pcT('取消收藏'),
            onClick: unsave
          },
          pcIcon('trash', 14)
        )
      ),
      h('div', { className: 'pc-pin-overlay-bottom' })
    )
  )

  const caption = h(
    'div',
    { className: 'pc-collection-pin-caption', style: { padding: '6px 2px 0', minWidth: 0 } },
    h('div', { className: 'pc-pin-title pc-collection-pin-title' }, title),
    meta ? h('div', { className: 'pc-pin-sub pc-ellipsis' }, meta) : null
  )

  return h(
    'div',
    {
      className: 'pc-collection-pin',
      role: 'button',
      tabIndex: 0,
      'aria-label': pcT('打开收藏：{name}', { name: title }),
      onClick: open,
      onKeyDown: handleKeyDown,
      onMouseEnter: function () {
        setHovered(true)
      },
      onMouseLeave: function () {
        setHovered(false)
      },
      onFocus: function () {
        setFocused(true)
      },
      onBlur: handleBlur,
      style: {
        position: 'relative',
        display: 'block',
        width: '100%',
        margin: '0 0 8px',
        padding: 0,
        border: 0,
        borderRadius: 10,
        background: 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
        breakInside: 'avoid',
        boxSizing: 'border-box'
      }
    },
    media,
    caption
  )
}

/** 菜单里的一项，hover 时用浅底色。 */
function CollectionMenuItem(props) {
  const [hovered, setHovered] = useState(false)
  return h(
    'button',
    {
      type: 'button',
      className: 'pc-collection-menu-item',
      'aria-label': props.label,
      autoFocus: !!props.autoFocus,
      onClick: props.onClick,
      onMouseEnter: function () {
        setHovered(true)
      },
      onMouseLeave: function () {
        setHovered(false)
      },
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        minHeight: 28,
        padding: '4px 8px',
        border: 0,
        borderRadius: 6,
        background: hovered ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
        color: props.danger ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: 12,
        lineHeight: 1.5,
        textAlign: 'left',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        boxSizing: 'border-box'
      }
    },
    pcIcon(props.icon || 'more', 13),
    h('span', { className: 'pc-ellipsis' }, props.label)
  )
}

/** 收藏夹的「更多」小菜单，绝对定位在面板内部。 */
function CollectionBoardMenu(props) {
  const board = props.board || {}
  const style = {
    position: 'absolute',
    top: props.top,
    left: props.left,
    zIndex: 40,
    minWidth: 156,
    padding: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: 10,
    background: 'var(--dsw-alias-bg-overlay)',
    boxShadow: '0 10px 26px var(--dsw-alias-border-l1)',
    boxSizing: 'border-box'
  }
  return h(
    'div',
    {
      ref: props.menuRef,
      className: 'pc-collection-menu',
      role: 'group',
      'aria-label': pcT('收藏夹「{name}」操作', { name: board.title || '' }),
      onBlur: props.onBlur,
      style: style
    },
    h(CollectionMenuItem, {
      label: pcT('重命名收藏夹'),
      icon: 'link',
      autoFocus: !props.confirmRemove,
      onClick: props.onRename
    }),
    board.isDefault
      ? null
      : h(CollectionMenuItem, {
          label: props.confirmRemove ? pcT('再次点击确认删除') : pcT('删除收藏夹'),
          icon: 'trash',
          danger: true,
          autoFocus: props.confirmRemove,
          onClick: props.onRemove
        })
  )
}

/** 空状态：整个收藏为空 / 当前收藏夹为空 / 搜索无结果。 */
function CollectionEmpty(props) {
  const kind = props.kind || 'collection'
  let text = pcT('还没有收藏。到右侧浏览 Pinterest，点 ♥ 就会出现在这里。')
  if (kind === 'board') text = pcT('这个收藏夹还是空的。到右侧浏览 Pinterest，点 ♥ 收藏就会进到这里。')
  if (kind === 'search') text = pcT('没有找到匹配「{query}」的收藏。', { query: props.query || '' })
  return h(
    'div',
    { className: 'pc-empty pc-collection-empty' },
    h(
      'span',
      {
        className: 'pc-collection-empty-icon',
        'aria-hidden': true,
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          height: 38,
          borderRadius: 999,
          background: 'var(--dsw-alias-bg-layer-2)',
          color: 'var(--dsw-alias-label-secondary)'
        }
      },
      pcIcon(kind === 'search' ? 'search' : 'heartFilled', 18)
    ),
    h('div', { style: { maxWidth: 240, lineHeight: 1.7 } }, text),
    kind === 'search'
      ? h(
          'button',
          {
            type: 'button',
            className: 'pc-btn',
            onClick: function () {
              collectionCall(props.onClear)
            }
          },
          pcT('清除搜索')
        )
      : null
  )
}

/** 首次加载：8 个骨架块 + 顶部 spinner 行。 */
function CollectionSkeleton() {
  const aspects = ['0.75', '1', '0.66', '1.2', '0.8', '0.62', '1', '0.72']
  return h(
    'div',
    { className: 'pc-collection-loading-view' },
    h(
      'div',
      { className: 'pc-feed-status pc-collection-loading', role: 'status' },
      h('span', { className: 'pc-spin', style: { display: 'inline-flex' } }, pcIcon('spinner', 13)),
      h('span', null, pcT('正在加载收藏…'))
    ),
    h(
      'div',
      {
        className: 'pc-collection-grid',
        'aria-hidden': true,
        style: { columnCount: 2, columnGap: 8 }
      },
      aspects.map(function (aspect, index) {
        return h('div', {
          key: 'collection-skeleton-' + index,
          className: 'pc-skeleton pc-collection-skeleton',
          style: {
            width: '100%',
            aspectRatio: aspect,
            marginBottom: 8,
            breakInside: 'avoid'
          }
        })
      })
    )
  )
}

/** 左侧收藏面板主组件。 */
function CollectionPane(props) {
  const safeProps = props || {}
  const collection = safeProps.collection && typeof safeProps.collection === 'object' ? safeProps.collection : {}
  const boards = Array.isArray(collection.boards) ? collection.boards : []
  const pins = Array.isArray(collection.pins) ? collection.pins : []
  const query = typeof safeProps.query === 'string' ? safeProps.query : ''
  const loading = !!safeProps.loading
  const error = typeof safeProps.error === 'string' ? safeProps.error : ''
  const activeBoardId = safeProps.activeBoardId || collection.activeBoardId || 'all'

  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const menuTriggerRef = useRef(null)
  const [menu, setMenu] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [nameDialog, setNameDialog] = useState(null)

  const counts = useMemo(
    function () {
      const byBoard = {}
      for (let index = 0; index < pins.length; index += 1) {
        const pin = pins[index]
        if (!pin) continue
        const boardId = pin.boardId || 'default'
        byBoard[boardId] = (byBoard[boardId] || 0) + 1
      }
      return { byBoard: byBoard, total: pins.length }
    },
    [pins]
  )

  const visiblePins = useMemo(
    function () {
      const term = query.trim().toLowerCase()
      const sorted = pins.filter(Boolean).slice().sort(function (left, right) {
        return collectionTimeValue(right.savedAt) - collectionTimeValue(left.savedAt)
      })
      return sorted.filter(function (pin) {
        if (activeBoardId !== 'all' && pin.boardId !== activeBoardId) return false
        if (!term) return true
        const title = String(pin.title || '').toLowerCase()
        const description = String(pin.description || '').toLowerCase()
        return title.indexOf(term) !== -1 || description.indexOf(term) !== -1
      })
    },
    [pins, query, activeBoardId]
  )

  useEffect(
    function () {
      if (!menu) return undefined
      function handleDocumentMouseDown(event) {
        const menuNode = menuRef.current
        const triggerNode = menuTriggerRef.current
        if (menuNode && menuNode.contains(event.target)) return
        if (triggerNode && triggerNode.contains(event.target)) return
        setMenu(null)
        setConfirmRemove(false)
      }
      document.addEventListener('mousedown', handleDocumentMouseDown)
      return function cleanup() {
        document.removeEventListener('mousedown', handleDocumentMouseDown)
      }
    },
    [menu]
  )

  const boardTitles = {}
  for (let index = 0; index < boards.length; index += 1) {
    const board = boards[index]
    if (board && board.id) boardTitles[board.id] = board.title || ''
  }

  function boardCount(board) {
    if (!board) return 0
    if (typeof counts.byBoard[board.id] === 'number') return counts.byBoard[board.id]
    const declared = Number(board.count)
    return Number.isFinite(declared) ? declared : 0
  }

  function closeMenu(restoreFocus) {
    setMenu(null)
    setConfirmRemove(false)
    const trigger = menuTriggerRef.current
    if (restoreFocus && trigger && typeof trigger.focus === 'function') trigger.focus()
  }

  function openMenu(event, board) {
    if (!board) return
    const trigger = event.currentTarget
    const rootNode = rootRef.current
    menuTriggerRef.current = trigger
    const menuWidth = 156
    let left = 12
    let top = 52
    if (rootNode && trigger && typeof trigger.getBoundingClientRect === 'function') {
      const rootRect = rootNode.getBoundingClientRect()
      const triggerRect = trigger.getBoundingClientRect()
      left = Math.max(8, Math.min(triggerRect.left - rootRect.left, rootRect.width - menuWidth - 8))
      top = triggerRect.bottom - rootRect.top + 4
      if (top + 96 > rootRect.height) top = Math.max(8, triggerRect.top - rootRect.top - 96)
    }
    setConfirmRemove(false)
    setMenu(function (previous) {
      if (previous && previous.boardId === board.id) return null
      return { boardId: board.id, board: board, left: left, top: top }
    })
  }

  function handleRootKeyDown(event) {
    if (event.key !== 'Escape' || !menu) return
    event.stopPropagation()
    closeMenu(true)
  }

  function handleMenuBlur(event) {
    const next = event.relatedTarget
    if (next && event.currentTarget.contains(next)) return
    closeMenu(false)
  }

  function handleCreateBoard() {
    setNameDialog({ mode: 'create', board: null, value: '' })
  }

  function submitNameDialog(title) {
    const dialog = nameDialog
    setNameDialog(null)
    if (!dialog) return
    if (dialog.mode === 'create') collectionCall(safeProps.onCreateBoard, title)
    else if (dialog.board) collectionCall(safeProps.onRenameBoard, dialog.board.id, title)
  }

  function handleRenameBoard() {
    const current = menu && menu.board
    if (!current) return
    const dialog = { mode: 'rename', board: current, value: current.title || '' }
    closeMenu(true)
    setNameDialog(dialog)
  }

  function handleRemoveBoard() {
    const current = menu && menu.board
    if (!current) return
    if (!confirmRemove) {
      setConfirmRemove(true)
      return
    }
    closeMenu(true)
    collectionCall(safeProps.onRemoveBoard, current.id)
  }

  const rootStyle = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
    color: 'var(--dsw-alias-label-primary)',
    fontSize: 12,
    lineHeight: 1.5
  }

  const toolbar = h(
    'div',
    {
      className: 'pc-toolbar pc-collection-toolbar',
      style: { height: 44, flex: '0 0 44px', minHeight: 44, boxSizing: 'border-box' }
    },
    h('span', { className: 'pc-toolbar-title pc-collection-title' }, pcT('我的收藏')),
    h(
      'span',
      {
        className: 'pc-count pc-collection-count',
        title: pcT('共 {n} 个收藏', { n: counts.total }),
        'aria-label': pcT('共 {n} 个收藏', { n: counts.total })
      },
      String(counts.total)
    ),
    h('span', { style: { flex: '1 1 auto' } }),
    h(CollectionIconButton, {
      icon: 'plus',
      label: pcT('新建收藏夹'),
      title: pcT('新建收藏夹'),
      iconSize: 15,
      className: 'pc-collection-new-board',
      onClick: handleCreateBoard
    })
  )

  const chipItems = [
    h(CollectionBoardChip, {
      key: 'collection-chip-all',
      board: { id: 'all', title: pcT('全部') },
      count: counts.total,
      active: activeBoardId === 'all',
      onSelect: safeProps.onSelectBoard
    })
  ]
  for (let index = 0; index < boards.length; index += 1) {
    const board = boards[index]
    if (!board || !board.id) continue
    chipItems.push(
      h(CollectionBoardChip, {
        key: 'collection-chip-' + board.id,
        board: board,
        count: boardCount(board),
        active: activeBoardId === board.id,
        menuOpen: !!menu && menu.boardId === board.id,
        onSelect: safeProps.onSelectBoard,
        onMenu: openMenu
      })
    )
  }
  const chipsRow = h(
    'div',
    {
      className: 'pc-topic-row pc-collection-chips',
      style: { borderBottom: 'none', padding: '0 12px 8px', gap: 6 }
    },
    chipItems
  )

  const searchRow = h(
    'div',
    {
      className: 'pc-collection-search',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 30,
        margin: '0 12px 8px',
        padding: '0 8px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
        background: 'var(--dsw-alias-bg-base)',
        boxSizing: 'border-box',
        flex: '0 0 30px'
      }
    },
    h(
      'span',
      {
        'aria-hidden': true,
        style: { display: 'inline-flex', color: 'var(--dsw-alias-label-secondary)', flex: '0 0 auto' }
      },
      pcIcon('search', 13)
    ),
    h('input', {
      type: 'text',
      className: 'pc-input pc-collection-search-input',
      value: query,
      placeholder: pcT('搜索收藏'),
      'aria-label': pcT('搜索收藏'),
      autoComplete: 'off',
      spellCheck: false,
      enterKeyHint: 'search',
      onChange: function (event) {
        collectionCall(safeProps.onQueryChange, event.target.value)
      },
      style: {
        flex: '1 1 auto',
        width: 'auto',
        minWidth: 0,
        height: '100%',
        padding: 0,
        border: 0,
        borderRadius: 0,
        background: 'transparent',
        outline: 'none',
        fontFamily: 'inherit',
        fontSize: 12,
        color: 'var(--dsw-alias-label-primary)'
      }
    }),
    query
      ? h(CollectionIconButton, {
          icon: 'close',
          label: pcT('清除搜索'),
          title: pcT('清除搜索'),
          size: 20,
          iconSize: 11,
          radius: 999,
          onClick: function () {
            collectionCall(safeProps.onQueryChange, '')
          }
        })
      : null
  )

  const errorAlert =
    error && !loading
      ? h(
          'div',
          {
            className: 'pc-alert pc-collection-error',
            'data-tone': 'error',
            role: 'alert',
            style: { margin: '8px 0', alignItems: 'center' }
          },
          h(
            'span',
            {
              className: 'pc-alert-icon',
              'aria-hidden': true,
              style: { display: 'inline-flex', flex: '0 0 auto' }
            },
            pcIcon('refresh', 14)
          ),
          h(
            'span',
            { className: 'pc-collection-error-text', style: { flex: '1 1 auto', minWidth: 0, lineHeight: 1.6 } },
            error
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'pc-btn pc-collection-retry',
              'aria-label': pcT('重试加载收藏'),
              onClick: function () {
                collectionCall(safeProps.onRetry)
              },
              style: { height: 26, padding: '0 10px', fontSize: 11 }
            },
            pcT('重试')
          )
        )
      : null

  let content = null
  if (loading) {
    content = h(CollectionSkeleton, null)
  } else if (!pins.length) {
    if (!error) content = h(CollectionEmpty, { kind: 'collection' })
  } else if (!visiblePins.length) {
    content = h(CollectionEmpty, {
      kind: query.trim() ? 'search' : 'board',
      query: query.trim(),
      onClear: function () {
        collectionCall(safeProps.onQueryChange, '')
      }
    })
  } else {
    content = h(
      'div',
      { className: 'pc-collection-grid', style: { columnCount: 2, columnGap: 8 } },
      visiblePins.map(function (pin, index) {
        return h(CollectionPinCard, {
          key: pin.savedId || pin.id || 'collection-pin-' + index,
          pin: pin,
          showBoard: activeBoardId === 'all',
          boardTitle: boardTitles[pin.boardId] || '',
          onOpen: safeProps.onOpenPin,
          onUnsave: safeProps.onUnsave
        })
      })
    )
  }

  const body = h(
    'div',
    {
      className: 'pc-collection-body pc-scroll',
      'aria-busy': loading ? 'true' : undefined,
      style: {
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        padding: '0 12px 12px',
        boxSizing: 'border-box'
      }
    },
    errorAlert,
    content
  )

  const menuNode = menu
    ? h(CollectionBoardMenu, {
        board: menu.board,
        top: menu.top,
        left: menu.left,
        menuRef: menuRef,
        confirmRemove: confirmRemove,
        onRename: handleRenameBoard,
        onRemove: handleRemoveBoard,
        onBlur: handleMenuBlur
      })
    : null

  return h(
    'div',
    {
      ref: rootRef,
      className: 'pc-collection',
      role: 'region',
      'aria-label': pcT('我的收藏'),
      onKeyDown: handleRootKeyDown,
      style: rootStyle
    },
    toolbar,
    chipsRow,
    searchRow,
    body,
    menuNode,
    nameDialog
      ? h(CollectionNameDialog, {
          mode: nameDialog.mode,
          initialValue: nameDialog.value,
          onCancel: function () {
            setNameDialog(null)
          },
          onSubmit: submitNameDialog
        })
      : null
  )
}
