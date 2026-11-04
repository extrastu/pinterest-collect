/**
 * Pin 详情页(不是弹窗):占满右侧浏览区的一页,大图 + 元信息,下面接
 * 「更多类似」的 Pinterest 推荐流,可以一直点下去 —— 详情不再是死路。
 *
 * 交互:
 *  - 点推荐里的 Pin 会继续在当前页打开(内部维护返回栈);
 *  - 顶部「返回」回到上一个详情,栈空时回到原来的推荐流/搜索结果(浏览位置保留);
 *  - 收藏动作复用 App 的 saveMap / onSave / onUnsave。
 */

function pcDedupe(list) {
  const seen = new Set()
  const output = []
  for (const item of list || []) {
    if (!item || !item.id || seen.has(item.id)) continue
    seen.add(item.id)
    output.push(item)
  }
  return output
}

function PinCloseUp(props) {
  const {
    pin,
    stackDepth,
    boards,
    savedMap,
    savedRecordMap,
    savingPinId,
    defaultBoardId,
    onSave,
    onUnsave,
    onUpdateNote,
    onBack,
    onOpenPin,
    onToast
  } = props

  const [related, setRelated] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [boardId, setBoardId] = useState(defaultBoardId || PC_DEFAULT_BOARD)
  const [reloadKey, setReloadKey] = useState(0)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const scrollRef = useRef(null)
  const requestRef = useRef(0)
  const [imgFailed, setImgFailed] = useState(false)

  const pinId = pin ? pin.id : ''
  const pinTitle = pin ? pin.title || pin.description || '' : ''
  const pinDesc = pin ? pin.description || '' : ''

  // 派生值放在 hook 之前:备注同步 effect 的依赖数组在渲染期就会求值,
  // 若声明放在下面会踩 TDZ(Cannot access 'savedId' before initialization)。
  const savedId = pin && savedMap ? savedMap.get(pin.id) : undefined
  const saved = Boolean(savedId)
  const savedRecord = saved && savedRecordMap ? savedRecordMap.get(pin.id) : undefined
  const savedNote = (savedRecord && savedRecord.note) || ''

  useEffect(() => {
    setBoardId(defaultBoardId || PC_DEFAULT_BOARD)
    setImgFailed(false)
  }, [pinId, defaultBoardId])

  // 收藏状态/备注变化时同步草稿:换 Pin、刚收藏、或备注在别处更新,都回到阅读态
  useEffect(() => {
    setNoteDraft(savedNote)
    setNoteEditing(false)
    setNoteSaving(false)
  }, [pinId, savedId, savedNote])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [pinId])

  // 打开任意 Pin 时拉一页「更多类似」
  useEffect(() => {
    if (!pinId) return undefined
    let active = true
    const requestId = ++requestRef.current
    setRelated([])
    setStatus('loading')
    setError('')
    async function load() {
      try {
        const params = new URLSearchParams({ id: pinId, limit: '24' })
        if (pinTitle) params.set('title', pinTitle.slice(0, 120))
        if (pinDesc) params.set('description', pinDesc.slice(0, 200))
        const data = await pcFetch(`/related?${params.toString()}`)
        if (!active || requestId !== requestRef.current) return
        setRelated(pcDedupe((data && data.pins) || []))
        setStatus('ready')
      } catch (error_) {
        if (!active || requestId !== requestRef.current) return
        setError((error_ && error_.message) || pcT('推荐加载失败'))
        setStatus('error')
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [pinId, pinTitle, pinDesc, reloadKey])

  if (!pin) return null

  const saving = savingPinId === pin.id
  const image = imgFailed ? pin.image : pin.imageLarge || pin.image
  const pinner = pin.pinner || {}
  const pinBoard = pin.board || {}
  const sourceHref = pcIsLink(pin.pinUrl) ? pin.pinUrl : pin.sourceUrl

  function toggleSave() {
    if (saving) return
    if (saved) onUnsave && onUnsave(savedId, pin)
    else onSave && onSave(pin, boardId, noteDraft.trim())
  }

  async function commitNote() {
    if (!savedId || !onUpdateNote || noteSaving) return
    const value = noteDraft.trim()
    setNoteSaving(true)
    try {
      const ok = await onUpdateNote(savedId, value)
      if (ok !== false) setNoteEditing(false)
    } finally {
      setNoteSaving(false)
    }
  }

  const relatedBody = (() => {
    if (status === 'loading') {
      return h(
        'div',
        { className: 'pc-masonry', 'aria-hidden': true },
        [220, 180, 240, 196, 210, 236].map((height, index) =>
          h('div', { key: index, className: 'pc-pin-card', style: { height }, 'aria-hidden': true }, h('div', { className: 'pc-skeleton', style: { height: '100%', borderRadius: 16 } }))
        )
      )
    }
    if (status === 'error' && !related.length) {
      return h(
        'div',
        { className: 'pc-empty', role: 'alert' },
        h('strong', null, pcT('推荐没加载出来')),
        h('span', null, error || pcT('Pinterest 这次没给推荐,可以重试或返回推荐流')),
        h(
          'div',
          { className: 'pc-empty-actions' },
          h('button', { type: 'button', className: 'pc-btn', onClick: () => setReloadKey(key => key + 1) }, pcT('重试'))
        )
      )
    }
    if (!related.length) {
      return h(
        'div',
        { className: 'pc-empty' },
        h('strong', null, pcT('这条 Pin 暂时没有相似推荐')),
        h('span', null, pcT('点左上角返回,继续看你的推荐流'))
      )
    }
    return h(
      'div',
      { className: 'pc-masonry' },
      related.map(item =>
        h(PcPinCard, {
          key: item.id,
          pin: item,
          savedId: savedMap ? savedMap.get(item.id) : undefined,
          saving: savingPinId === item.id,
          onSave: itemPin => onSave && onSave(itemPin, boardId),
          onUnsave,
          onOpen: onOpenPin
        })
      )
    )
  })()

  return h(
    'div',
    { className: 'pc-closeup', role: 'region', 'aria-label': pcT('Pin 详情') },
    h(
      'div',
      { className: 'pc-closeup-bar' },
      h(
        'button',
        {
          type: 'button',
          className: 'pc-icon-btn',
          onClick: onBack,
          title: stackDepth > 1 ? pcT('返回上一个 Pin') : pcT('返回浏览'),
          'aria-label': stackDepth > 1 ? pcT('返回上一个 Pin') : pcT('返回浏览')
        },
        pcIcon('arrowLeft', 16)
      ),
      h(
        'span',
        { className: 'pc-closeup-hint pc-ellipsis' },
        stackDepth > 1 ? pcT('已看 {count} 个 Pin · 下面还有更多类似', { count: stackDepth }) : pcT('下面还有更多类似 Pin,可以一直点下去')
      ),
      sourceHref
        ? h(
            'a',
            { className: 'pc-btn', href: sourceHref, target: '_blank', rel: 'noreferrer noopener' },
            pcIcon('external', 13),
            h('span', null, pcT('原帖'))
          )
        : null
    ),
    h(
      'div',
      { className: 'pc-closeup-scroll pc-scroll', ref: scrollRef },
      h(
        'div',
        { className: 'pc-closeup-card' },
        h(
          'div',
          { className: 'pc-closeup-media' },
          image && !imgFailed
            ? h('img', {
                src: image,
                alt: pin.title || pin.description || 'Pinterest pin',
                referrerPolicy: 'no-referrer',
                draggable: false,
                onError: () => setImgFailed(true)
              })
            : h('div', { className: 'pc-pin-fallback' }, pcIcon('pin', 30))
        ),
        h(
          'div',
          { className: 'pc-closeup-info' },
          h('h2', { className: 'pc-closeup-title' }, pin.title || pin.description || 'Pinterest Pin'),
          pin.description && pin.description !== pin.title
            ? h('p', { className: 'pc-detail-desc' }, pin.description)
            : null,
          h(
            'div',
            { className: 'pc-detail-meta' },
            h('span', { className: 'pc-avatar', 'aria-hidden': true }, pcInitials(pinner.name || pinner.username)),
            h(
              'span',
              { className: 'pc-detail-meta-text' },
              h('strong', null, pinner.name || pinner.username || (pin.siteName ? pcT('来自 {site}', { site: pin.siteName }) : 'Pinterest')),
              h('span', null, pinBoard.name ? pcT('收藏于「{board}」', { board: pinBoard.name }) : pin.isVideo ? pcT('视频 Pin') : 'Pinterest')
            )
          ),
          h(
            'div',
            { className: 'pc-detail-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'pc-save-primary',
                'data-saved': saved ? 'true' : 'false',
                'aria-pressed': saved ? 'true' : 'false',
                disabled: saving,
                onClick: toggleSave
              },
              pcIcon(saved ? 'heartFilled' : 'heart', 14),
              h('span', null, saving ? pcT('处理中') : saved ? pcT('已收藏 · 取消') : pcT('收藏到我的收藏'))
            ),
            !saved
              ? h(
                  'select',
                  {
                    className: 'pc-board-select',
                    'aria-label': pcT('收藏到哪个收藏夹'),
                    value: boardId,
                    disabled: saving,
                    onChange: event => setBoardId(event.target.value)
                  },
                  (Array.isArray(boards) ? boards : []).map(board => h('option', { key: board.id, value: board.id }, board.title))
                )
              : null
          ),
          h(
            'div',
            { className: 'pc-note' },
            saved
              ? noteEditing
                ? h(
                    'div',
                    { className: 'pc-note-editor' },
                    h('textarea', {
                      className: 'pc-note-input',
                      rows: 2,
                      maxLength: 280,
                      value: noteDraft,
                      placeholder: pcT('为什么收藏它?(可选)'),
                      'aria-label': pcT('收藏备注'),
                      autoFocus: true,
                      onChange: event => setNoteDraft(event.target.value),
                      onKeyDown: event => {
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          setNoteDraft(savedNote)
                          setNoteEditing(false)
                        } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                          event.preventDefault()
                          void commitNote()
                        }
                      }
                    }),
                    h(
                      'div',
                      { className: 'pc-note-editor-actions' },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'pc-btn',
                          onClick: function () {
                            setNoteDraft(savedNote)
                            setNoteEditing(false)
                          }
                        },
                        pcT('取消')
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'pc-save-primary pc-note-save',
                          disabled: noteSaving || noteDraft.trim() === savedNote,
                          onClick: function () {
                            void commitNote()
                          }
                        },
                        noteSaving ? pcT('保存中') : pcT('保存备注')
                      )
                    )
                  )
                : savedNote
                  ? h(
                      'div',
                      { className: 'pc-note-read' },
                      h('span', { className: 'pc-note-glyph', 'aria-hidden': true }, pcIcon('pencil', 12)),
                      h('p', { className: 'pc-note-text' }, savedNote),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'pc-note-edit',
                          'aria-label': pcT('编辑备注'),
                          onClick: function () {
                            setNoteEditing(true)
                          }
                        },
                        pcT('编辑')
                      )
                    )
                  : h(
                      'button',
                      {
                        type: 'button',
                        className: 'pc-note-add',
                        onClick: function () {
                          setNoteEditing(true)
                        }
                      },
                      pcIcon('plus', 12),
                      h('span', null, pcT('记一句为什么收藏它'))
                    )
              : h('input', {
                  type: 'text',
                  className: 'pc-note-input pc-note-input-single',
                  value: noteDraft,
                  maxLength: 280,
                  placeholder: pcT('为什么收藏它?(可选)'),
                  'aria-label': pcT('收藏备注'),
                  onChange: event => setNoteDraft(event.target.value),
                  onKeyDown: event => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      toggleSave()
                    }
                  }
                })
          ),
          sourceHref
            ? h('div', { className: 'pc-detail-foot' }, pcIcon('link', 12), h('span', { className: 'pc-ellipsis', style: { minWidth: 0 } }, sourceHref))
            : null
        )
      ),
      h(
        'div',
        { className: 'pc-closeup-related' },
        h(
          'div',
          { className: 'pc-closeup-related-head' },
          h('h3', null, pcT('更多类似')),
          h('span', null, pcT('来自 Pinterest 的推荐'))
        ),
        relatedBody,
        status === 'ready' && related.length
          ? h('div', { className: 'pc-feed-status' }, h('span', null, pcT('点任意一张继续看,或返回你的推荐流')))
          : null
      )
    )
  )
}
