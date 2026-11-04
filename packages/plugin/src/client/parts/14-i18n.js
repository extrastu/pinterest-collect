/* eslint-disable */
/**
 * 极简 i18n:字典以「中文原文」为 key,英文缺翻译时自动回退中文。
 *
 * 语言跟随 Harness 的 locale 服务(设置面板可切换),切换时 `pcApplyLocaleSnapshot`
 * 会通知订阅者重渲染;组件里直接调用 `pcT('中文')` 即可,不需要传 t。
 *
 * 约定:
 *   pcT('收藏')                          → 静态文案
 *   pcT('已收藏到「{board}」', { board })  → 带占位符,替换 {board}
 *   pcAddDict({ '收藏': 'Save' })         → 注册英文(其他 part 文件里成批注册)
 */

const PC_TRANSLATIONS_EN = {}

function pcAddDict(dict) {
  if (!dict) return
  for (const key of Object.keys(dict)) {
    const value = dict[key]
    if (typeof value === 'string' && value) PC_TRANSLATIONS_EN[key] = value
  }
}

let pcLocaleSnapshot = { active: 'zh' }
let pcLocaleRevision = 0
const pcLocaleSubscribers = new Set()

function pcIsEnglish() {
  return !/^zh/i.test(String((pcLocaleSnapshot && pcLocaleSnapshot.active) || 'zh'))
}

function pcFormat(text, params) {
  const raw = String(text == null ? '' : text)
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key]
    return value === undefined || value === null ? match : String(value)
  })
}

/** 翻译一段中文文案;英文缺失时回退中文。 */
function pcT(text, params) {
  if (text === null || text === undefined) return ''
  const source = String(text)
  const translated = pcIsEnglish() ? PC_TRANSLATIONS_EN[source] : undefined
  return pcFormat(translated || source, params)
}

function pcApplyLocaleSnapshot(snapshot) {
  pcLocaleSnapshot = snapshot || { active: 'zh' }
  pcLocaleRevision += 1
  for (const listener of pcLocaleSubscribers) {
    try {
      listener(pcLocaleRevision)
    } catch {
      /* 单个订阅者出错不影响其他 */
    }
  }
}

/** 组件里调一次即可在语言切换时重渲染(返回值仅为触发依赖)。 */
function usePcLocaleRevision() {
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const listener = () => setRevision(value => value + 1)
    pcLocaleSubscribers.add(listener)
    return () => {
      pcLocaleSubscribers.delete(listener)
    }
  }, [])
  return revision
}

/* ---------- Harness 客户端服务(主题 / 语言),由 pcStart 绑定 ---------- */

let pcThemeService = null
let pcLocaleService = null

function pcBindServices(services) {
  pcThemeService = (services && services.theme) || null
  pcLocaleService = (services && services.locale) || null
  if (pcLocaleService && typeof pcLocaleService.getLocale === 'function') {
    try {
      pcApplyLocaleSnapshot(pcLocaleService.getLocale())
    } catch {
      /* 忽略 */
    }
  }
}

function pcGetThemeSnapshot() {
  if (!pcThemeService || typeof pcThemeService.getTheme !== 'function') return null
  try {
    return pcThemeService.getTheme()
  } catch {
    return null
  }
}

function pcSetThemePreference(id) {
  if (!pcThemeService || typeof pcThemeService.setTheme !== 'function') return false
  try {
    pcThemeService.setTheme(id)
    return true
  } catch {
    return false
  }
}

function pcGetLocaleSnapshot() {
  if (!pcLocaleService || typeof pcLocaleService.getLocale !== 'function') return null
  try {
    return pcLocaleService.getLocale()
  } catch {
    return null
  }
}

function pcSetLocalePreference(id) {
  if (!pcLocaleService || typeof pcLocaleService.setLocale !== 'function') return false
  try {
    pcLocaleService.setLocale(id)
    return true
  } catch {
    return false
  }
}
