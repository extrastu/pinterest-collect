/* eslint-disable */
/**
 * 设置页(占满右侧浏览区的一页,不是弹窗),双栏:
 *   左侧 = 设置项列表(账号 / 外观 / 语言 / 关于)
 *   右侧 = 当前设置项的详情
 * 外观/语言写 Harness 客户端服务(ctx.theme / ctx.locale),全局生效并持久化。
 */

const PC_SETTINGS_SECTIONS = [
  { id: 'account', label: '账号', icon: 'pin' },
  { id: 'appearance', label: '外观', icon: 'sun' },
  { id: 'language', label: '语言', icon: 'globe' },
  { id: 'about', label: '关于', icon: 'info' }
]

const PC_THEME_OPTIONS = [
  { id: 'system', label: '跟随系统', icon: 'monitor' },
  { id: 'light', label: '浅色', icon: 'sun' },
  { id: 'dark', label: '深色', icon: 'moon' }
]

function PcSettingsPanelHead(props) {
  return h(
    'div',
    { className: 'pc-settings-detail-head' },
    h('h3', { className: 'pc-settings-detail-title' }, props.title),
    props.desc ? h('p', { className: 'pc-settings-detail-desc' }, props.desc) : null
  )
}

function PcSettingsPage(props) {
  const { onBack, onToast, account, onLogout, onOpenAccount, onOpenLogin } = props
  const [section, setSection] = useState('appearance')
  const [busy, setBusy] = useState(false)
  const [, forceRefresh] = useState(0)

  const theme = pcGetThemeSnapshot()
  const locale = pcGetLocaleSnapshot()

  const activeTheme = (theme && theme.preference) || 'system'
  const locales =
    locale && Array.isArray(locale.locales) && locale.locales.length
      ? locale.locales
      : [
          { id: 'zh', label: '中文' },
          { id: 'en', label: 'English' }
        ]
  const activeLocale = (locale && locale.active) || 'zh'
  const viewer = (account && account.viewer) || null
  const loggedIn = Boolean(account && account.connected && account.valid)

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      if (onBack) onBack()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onBack])

  function chooseTheme(id) {
    if (!pcSetThemePreference(id)) {
      if (onToast) onToast(pcT('切换主题失败,当前环境不支持'))
      return
    }
    forceRefresh(value => value + 1)
  }

  function chooseLocale(id) {
    if (!pcSetLocalePreference(id)) {
      if (onToast) onToast(pcT('切换语言失败,当前环境不支持'))
      return
    }
    pcApplyLocaleSnapshot(pcGetLocaleSnapshot() || { active: id })
    forceRefresh(value => value + 1)
  }

  async function handleLogout() {
    if (!onLogout) return
    setBusy(true)
    try {
      await onLogout()
    } finally {
      setBusy(false)
    }
  }

  const nav = h(
    'nav',
    { className: 'pc-settings-nav', 'aria-label': pcT('设置') },
    PC_SETTINGS_SECTIONS.map(item =>
      h(
        'button',
        {
          key: item.id,
          type: 'button',
          className: 'pc-settings-nav-item',
          'aria-current': section === item.id ? 'page' : undefined,
          onClick: () => setSection(item.id)
        },
        pcIcon(item.icon, 14),
        h('span', null, pcT(item.label))
      )
    )
  )

  let detail = null
  if (section === 'account') {
    const accountBody = loggedIn
      ? h(
          'div',
          { className: 'pc-settings-account' },
          h(PcAvatar, {
            src: viewer && viewer.avatar,
            name: (viewer && (viewer.name || viewer.username)) || 'Pinterest',
            size: 44
          }),
          h(
            'div',
            { className: 'pc-settings-account-text' },
            h('strong', null, (viewer && (viewer.name || viewer.username)) || pcT('已连接 Pinterest')),
            h(
              'span',
              null,
              viewer && viewer.username
                ? `@${viewer.username}`
                : account && account.updatedAt
                  ? pcT('登录时间 {time}', { time: pcTimeAgo(account.updatedAt) })
                  : pcT('已连接 Pinterest')
            ),
            viewer && (viewer.pinCount || viewer.boardCount)
              ? h(
                  'span',
                  null,
                  pcT('{pins} 个 Pin · {boards} 个画板', { pins: viewer.pinCount || 0, boards: viewer.boardCount || 0 })
                )
              : null
          )
        )
      : h(
          'div',
          { className: 'pc-settings-account' },
          h(PcAvatar, { name: 'Pinterest', size: 44 }),
          h(
            'div',
            { className: 'pc-settings-account-text' },
            h('strong', null, pcT('未登录')),
            h('span', null, pcT('登录后这里会显示你的 Pinterest 名称和头像。'))
          )
        )

    const accountActions = loggedIn
      ? h(
          'div',
          { className: 'pc-settings-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'pc-btn',
              disabled: !onOpenAccount,
              onClick: () => {
                if (onOpenAccount) onOpenAccount()
              }
            },
            pcIcon('grid', 13),
            h('span', null, pcT('查看账号'))
          ),
          h(
            'button',
            { type: 'button', className: 'pc-btn', disabled: busy, onClick: () => { void handleLogout() } },
            pcIcon('close', 13),
            h('span', null, pcT('退出登录'))
          )
        )
      : h(
          'div',
          { className: 'pc-settings-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'pc-save-primary',
              onClick: () => {
                if (onOpenLogin) onOpenLogin()
              }
            },
            pcIcon('pin', 14),
            h('span', null, pcT('登录 Pinterest'))
          )
        )

    detail = h(
      'div',
      { className: 'pc-settings-detail-card' },
      h(PcSettingsPanelHead, {
        title: pcT('账号'),
        desc: pcT('这里显示当前登录的 Pinterest 账号;登录态只保存在本机。')
      }),
      accountBody,
      accountActions
    )
  } else if (section === 'appearance') {
    detail = h(
      'div',
      { className: 'pc-settings-detail-card' },
      h(PcSettingsPanelHead, {
        title: pcT('外观'),
        desc: pcT('跟随系统时会随 macOS/Windows 的深浅色自动切换;也可以固定浅色或深色。')
      }),
      h(
        'div',
        { className: 'pc-segment', role: 'group', 'aria-label': pcT('外观') },
        PC_THEME_OPTIONS.map(option =>
          h(
            'button',
            {
              key: option.id,
              type: 'button',
              'aria-pressed': activeTheme === option.id ? 'true' : 'false',
              onClick: () => chooseTheme(option.id)
            },
            pcIcon(option.icon, 14),
            h('span', null, pcT(option.label))
          )
        )
      ),
      h('p', { className: 'pc-settings-hint' }, pcT('主题属于 Harness 全局偏好,整个界面会一起切换,并会被持久化。'))
    )
  } else if (section === 'language') {
    detail = h(
      'div',
      { className: 'pc-settings-detail-card' },
      h(PcSettingsPanelHead, {
        title: pcT('语言'),
        desc: pcT('语言属于 Harness 全局偏好,切换后面板与整个界面一起生效。')
      }),
      h(
        'div',
        { className: 'pc-segment', role: 'group', 'aria-label': pcT('语言') },
        locales.map(item =>
          h(
            'button',
            {
              key: item.id,
              type: 'button',
              'aria-pressed': activeLocale === item.id ? 'true' : 'false',
              onClick: () => chooseLocale(item.id)
            },
            h('span', null, item.label || item.id)
          )
        )
      )
    )
  } else {
    detail = h(
      'div',
      { className: 'pc-settings-detail-card' },
      h(PcSettingsPanelHead, { title: pcT('关于'), desc: pcT('版本信息与本地数据位置。') }),
      h(
        'ul',
        { className: 'pc-settings-list' },
        h('li', null, h('span', null, pcT('版本')), h('strong', null, 'Pinterest 收藏 v1.2.0')),
        h('li', null, h('span', null, pcT('数据位置')), h('code', null, '~/.dsh/pinterest-collect/')),
        h('li', null, h('span', null, pcT('说明')), h('span', null, pcT('收藏与登录态只保存在本机。')))
      ),
      h(
        'div',
        { className: 'pc-settings-promo' },
        h('h4', { className: 'pc-settings-promo-title' }, pcT('相关 App')),
        h('p', { className: 'pc-settings-hint' }, pcT('在 iPhone / iPad 上保存社交平台上的帖子(含 Pinterest)。')),
        h(PcPromoCard)
      )
    )
  }

  return h(
    'div',
    { className: 'pc-settings-page', role: 'region', 'aria-label': pcT('设置') },
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
      h('span', { className: 'pc-settings-page-title' }, pcT('设置'))
    ),
    h(
      'div',
      { className: 'pc-settings-body' },
      nav,
      h('div', { className: 'pc-settings-detail pc-scroll' }, detail)
    )
  )
}
