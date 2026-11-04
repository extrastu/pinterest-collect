/* eslint-disable */
/**
 * 共享层：React 句柄、Host API 调用、图标、格式化。
 * 这个文件与 10/20/30/90 号片段被 build-client.mjs 拼进同一个 factory 作用域，
 * 所以这里是普通声明，没有 import/export。
 */
const React = require('react')
const h = React.createElement
const useState = React.useState
const useEffect = React.useEffect
const useMemo = React.useMemo
const useRef = React.useRef
const useCallback = React.useCallback

const PC_PLUGIN_ID = 'pinterest-collect'
const PC_PANEL_ID = 'pinterest-collect'
const PC_API = '/pinterest-api'
const PC_DEFAULT_BOARD = 'default'

const PC_STATE_COLORS = {
  danger: 'var(--dsw-alias-state-error-primary)',
  success: 'var(--dsw-alias-state-success-primary)',
  warn: 'var(--dsw-alias-state-warn-primary)'
}

/**
 * 同源调用 Host 的 /pinterest-api。GET 不传 body,POST 传 JSON。
 * 非 2xx 时抛出带 status 的 Error(message 来自 Host)。
 */
async function pcFetch(pathname, body) {
  const init = body === undefined
    ? { headers: { accept: 'application/json' } }
    : {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body)
      }
  let response
  try {
    response = await fetch(`${PC_API}${pathname}`, init)
  } catch (error) {
    throw new Error(pcT('连不上收藏服务,请稍后重试'))
  }
  let payload = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }
  if (!response.ok) {
    const message = payload && payload.error ? payload.error : pcT('请求失败 ({status})', { status: response.status })
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return payload
}

function pcTimeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Date.now() - then
  if (diff < 60 * 1000) return pcT('刚刚')
  if (diff < 60 * 60 * 1000) return pcT('{n} 分钟前', { n: Math.floor(diff / 60000) })
  if (diff < 24 * 60 * 60 * 1000) return pcT('{n} 小时前', { n: Math.floor(diff / 3600000) })
  if (diff < 7 * 24 * 60 * 60 * 1000) return pcT('{n} 天前', { n: Math.floor(diff / 86400000) })
  const date = new Date(then)
  return pcT('{m}月{d}日', { m: date.getMonth() + 1, d: date.getDate() })
}

/** CSS aspect-ratio 值,给图片占位用,避免加载后跳动。 */
function pcAspect(pin) {
  const width = Number(pin && pin.width) || 0
  const height = Number(pin && pin.height) || 0
  if (width > 0 && height > 0) {
    const ratio = width / height
    const safe = Math.min(Math.max(ratio, 0.52), 1.6)
    return safe.toFixed(4)
  }
  return '0.75'
}

function pcInitials(name) {
  const text = String(name || '').trim()
  if (!text) return 'P'
  return text.slice(0, 1).toUpperCase()
}

function pcIsLink(value) {
  return /^https?:\/\//i.test(String(value || '').trim())
}

function pcParseQuery(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  if (!/^https?:\/\//i.test(raw)) return raw
  try {
    const url = new URL(raw)
    if (!/(^|\.)pinterest\.[a-z.]+$/i.test(url.hostname) && !/(^|\.)pin\.it$/i.test(url.hostname)) {
      return raw
    }
    const q = url.searchParams.get('q') || url.searchParams.get('query')
    if (q) return q.trim()
    const segments = url.pathname.split('/').filter(Boolean)
    const pinIndex = segments.indexOf('pin')
    if (pinIndex >= 0) {
      const next = segments[pinIndex + 1] || ''
      return /^[a-z0-9_-]{6,}$/i.test(next) ? '' : raw
    }
    const words = segments
      .filter(segment => !['search', 'pins', 'ideas', 'boards', '_created', '_saved'].includes(segment))
      .filter(segment => /^[a-z0-9-]+$/i.test(segment))
      .map(segment => segment.replace(/-/g, ' '))
    return words.length ? words.slice(-2).join(' ') : raw
  } catch {
    return raw
  }
}

const PC_ICON_PATHS = {
  pin: [
    ['path', { d: 'M12 21.5s7.2-6.3 7.2-11.4a7.2 7.2 0 1 0-14.4 0C4.8 15.2 12 21.5 12 21.5Z' }],
    ['circle', { cx: 12, cy: 10, r: 2.6 }]
  ],
  heart: [
    ['path', { d: 'M20.6 5.8a5.1 5.1 0 0 0-7.2 0L12 7.2l-1.4-1.4a5.1 5.1 0 1 0-7.2 7.2L12 21.2l8.6-8.2a5.1 5.1 0 0 0 0-7.2Z' }]
  ],
  heartFilled: [
    ['path', { d: 'M20.6 5.8a5.1 5.1 0 0 0-7.2 0L12 7.2l-1.4-1.4a5.1 5.1 0 1 0-7.2 7.2L12 21.2l8.6-8.2a5.1 5.1 0 0 0 0-7.2Z', fill: 'currentColor', stroke: 'none' }]
  ],
  search: [
    ['circle', { cx: 11, cy: 11, r: 7 }],
    ['path', { d: 'm16.4 16.4 4.6 4.6' }]
  ],
  plus: [
    ['path', { d: 'M12 5v14M5 12h14' }]
  ],
  pencil: [
    ['path', { d: 'M4.5 19.5h3.6L19 8.6a1.8 1.8 0 0 0 0-2.5l-1.1-1.1a1.8 1.8 0 0 0-2.5 0L4.5 15.9v3.6Z' }],
    ['path', { d: 'm13.6 6.8 3.6 3.6' }]
  ],
  close: [
    ['path', { d: 'm6 6 12 12M18 6 6 18' }]
  ],
  trash: [
    ['path', { d: 'M4 7h16M10 7V4.8h4V7M6.4 7l1 12.2h9.2L17.6 7M10.2 10.8v5.6M13.8 10.8v5.6' }]
  ],
  external: [
    ['path', { d: 'M14 4h6v6M20 4l-8.4 8.4' }],
    ['path', { d: 'M18.4 14.2v5a1 1 0 0 1-1 1H5.6a1 1 0 0 1-1-1V7.4a1 1 0 0 1 1-1h5' }]
  ],
  refresh: [
    ['path', { d: 'M20 12a8 8 0 1 1-2.4-5.7' }],
    ['path', { d: 'M20 4.4V9h-4.6' }]
  ],
  grid: [
    ['rect', { x: 4, y: 4, width: 7, height: 7, rx: 1.6 }],
    ['rect', { x: 13, y: 4, width: 7, height: 7, rx: 1.6 }],
    ['rect', { x: 4, y: 13, width: 7, height: 7, rx: 1.6 }],
    ['rect', { x: 13, y: 13, width: 7, height: 7, rx: 1.6 }]
  ],
  folder: [
    ['path', { d: 'M3.6 7.6a2 2 0 0 1 2-2h3.7l1.9 2.1h6.9a2 2 0 0 1 2 2v7.2a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2Z' }]
  ],
  spinner: [
    ['circle', { cx: 12, cy: 12, r: 7.6, strokeOpacity: 0.25 }],
    ['path', { d: 'M12 4.4a7.6 7.6 0 0 1 7.6 7.6' }]
  ],
  link: [
    ['path', { d: 'M10.2 13.8a4 4 0 0 0 5.7 0l2.4-2.4a4 4 0 1 0-5.7-5.7l-1.2 1.2' }],
    ['path', { d: 'M13.8 10.2a4 4 0 0 0-5.7 0l-2.4 2.4a4 4 0 1 0 5.7 5.7l1.2-1.2' }]
  ],
  chevron: [
    ['path', { d: 'm9.5 6 6 6-6 6' }]
  ],
  check: [
    ['path', { d: 'm5 12.6 4.6 4.4L19 7.2' }]
  ],
  arrowLeft: [
    ['path', { d: 'M15 5.2 7.8 12 15 18.8' }]
  ],
  more: [
    ['circle', { cx: 5.5, cy: 12, r: 1.2, fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: 12, cy: 12, r: 1.2, fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: 18.5, cy: 12, r: 1.2, fill: 'currentColor', stroke: 'none' }]
  ],
  globe: [
    ['circle', { cx: 12, cy: 12, r: 8.2 }],
    ['path', { d: 'M3.9 12h16.2M12 3.8c2.4 2.3 3.7 5.1 3.7 8.2s-1.3 5.9-3.7 8.2c-2.4-2.3-3.7-5.1-3.7-8.2s1.3-5.9 3.7-8.2Z' }]
  ],
  info: [
    ['circle', { cx: 12, cy: 12, r: 8.2 }],
    ['path', { d: 'M12 11.2v5.3' }],
    ['circle', { cx: 12, cy: 8.2, r: 2.9, fill: 'currentColor', stroke: 'none' }]
  ],
  sun: [
    ['circle', { cx: 12, cy: 12, r: 4 }],
    ['path', { d: 'M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6' }]
  ],
  moon: [
    ['path', { d: 'M20.6 14.2A8.4 8.4 0 0 1 9.8 3.4a8.6 8.6 0 1 0 10.8 10.8Z' }]
  ],
  monitor: [
    ['rect', { x: 3.4, y: 4.6, width: 17.2, height: 12, rx: 2 }],
    ['path', { d: 'M9 20.2h6M12 16.6v3.6' }]
  ],
  settings: [
    ['circle', { cx: 12, cy: 12, r: 3.1 }],
    ['path', { d: 'M19.4 14.9a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.3a1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.7a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.3 9c.26.61.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z' }]
  ]
}

/** 线框图标,统一 24 视窗、currentColor 描边。 */
function pcIcon(name, size) {
  const spec = PC_ICON_PATHS[name] || PC_ICON_PATHS.pin
  const dimension = size || 16
  return h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: dimension,
      height: dimension,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: name === 'spinner' ? 'pc-spin' : undefined,
      'aria-hidden': true,
      focusable: 'false',
      style: { display: 'block', flex: '0 0 auto', pointerEvents: 'none' }
    },
    spec.map((entry, index) => h(entry[0], Object.assign({ key: index }, entry[1])))
  )
}

/** 圆形头像:有图用图,没图回退成名字首字;加载失败也回退。 */
function PcAvatar(props) {
  const size = props.size || 24
  const name = props.name || ''
  const [failed, setFailed] = useState(!props.src)
  const fallback = h(
    'span',
    {
      className: 'pc-avatar-circle',
      style: {
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.42)),
        borderRadius: '50%'
      },
      'aria-hidden': true
    },
    pcInitials(name)
  )
  if (!props.src || failed) return fallback
  return h('img', {
    className: 'pc-avatar-circle',
    src: props.src,
    alt: name,
    width: size,
    height: size,
    loading: 'lazy',
    referrerPolicy: 'no-referrer',
    draggable: false,
    style: { width: size, height: size, borderRadius: '50%' },
    onError: () => setFailed(true)
  })
}

/** 一个很小的「已收藏」角标,收藏卡片和浏览卡片共用。 */
function PcSavedBadge(props) {
  return h(
    'span',
    {
      className: 'pc-saved-badge',
      title: props.title || pcT('已收藏'),
      style: { display: 'inline-flex', alignItems: 'center', gap: 4 }
    },
    pcIcon('heartFilled', props.size || 12),
    props.label === false ? null : h('span', null, props.text || pcT('已收藏'))
  )
}
