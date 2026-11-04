/* eslint-disable */
/**
 * 设置页「相关 App」推荐位。
 *
 * 图标是内联 WebP data URI(不额外发起网络请求,点击才会跳到 App Store),
 * 想换成别的 App 只需要改 PC_PROMO 这一个常量。
 */
const PC_PROMO = {
  url: 'https://apps.apple.com/app/apple-store/id6816399878?pt=128665559&ct=pinterest-collect&mt=8',
  name: 'Post Saver: Save Social Posts',
  icon: 'data:image/webp;base64,UklGRuABAABXRUJQVlA4INQBAAAQDwCdASpgAGAAPmEukUWkIqGirVd4YIAMCWkDsACeX+PrNPJAcdqZmfEMQBqqt+Btd/C5u0KvPa2iqwSgyH6PdBchSGhyt4jf1z0TN/grApXz9kBBWxO3Gn3zuEWAZ8QhCfiBMyJMmmQEZkIoIkCR3VLMCemXxFsVS3Hx1Ds1hYAA/vxOUqnF+OorxqQJuZ/R30BUONtpKtzkXHd+dzrO2mIFpTfPazlW++3kSKH8fQ+2XD8uMsFcIcyeyOOwzd5vq+QypXPLc8Txlmwcp9TNrOTcWmZ/OwvkeAd/YF1GNyg8lirfJudf7H3OjV6IrFeNj2zswHw2x1Co66S9IanaSgMZfviOPj0DVFWUxyns/XzbRWyvRx3ecp/xQPa03V53t2JWLRCWeyuhoOPuZpgVIo0TgpwCqKfMAGqs5Oz9A70I1GBJjGPhmOKenjZm2nUh39dDhj2vfqWckAcwPSvq/4vzjRNEdh3CC1z6Jzrq+j+NM9tBS+WvjlN21GeTHIxwcUWCXC4DX8AGucL6SEJa9vamW51Qc9lsseW9mLPkgCo37SW7Nm0mfm8ZvZUz5b3JXEIEHJu4FagfeKg8h11BUVzpN9Vh9n4hw8g0Q8/StIAAAAA=',
  meta: '免费 · iOS 17+'
}

function PcPromoCard() {
  return h(
    'a',
    {
      className: 'pc-promo',
      href: PC_PROMO.url,
      target: '_blank',
      rel: 'noreferrer noopener',
      title: PC_PROMO.name
    },
    h('img', {
      className: 'pc-promo-icon',
      src: PC_PROMO.icon,
      alt: '',
      width: 48,
      height: 48,
      draggable: false
    }),
    h(
      'span',
      { className: 'pc-promo-text' },
      h('strong', null, PC_PROMO.name),
      h('span', null, pcT('iPhone / iPad 上保存社交帖子,覆盖 23 个平台(含 Pinterest)。')),
      h('span', { className: 'pc-promo-meta' }, pcT(PC_PROMO.meta))
    ),
    h('span', { className: 'pc-promo-cta' }, pcIcon('external', 13), h('span', null, 'App Store'))
  )
}
