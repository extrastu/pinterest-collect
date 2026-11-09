/* pinterest-collect · 客户端面板(由 build-client.mjs 生成,勿手改)
 * 左侧:我的 Pinterest 收藏;右侧:内嵌 Pinterest 浏览器 + Pin 详情。
 * 数据来源:同源 /pinterest-api(Host 端抓取 Pinterest)。
 */
window.__ModuleLoader__.load({
  id: 'pinterest-collect',
  factory(require) {
    const PC_CSS = "/* Pinterest 收藏 · 面板样式\n   规则:颜色只用 Harness 主题 token;唯一例外是「收藏」主按钮的品牌红(作品配色,见 CONTRACT.md)。\n   所有类以 pc- 前缀,避免与宿主和其他插件冲突。 */\n\n.pc-root {\n  box-sizing: border-box;\n  --pc-bg: var(--dsw-alias-bg-base);\n  --pc-surface: var(--dsw-alias-bg-layer-1);\n  --pc-surface-2: var(--dsw-alias-bg-layer-2);\n  --pc-overlay: var(--dsw-alias-bg-overlay);\n  --pc-border: var(--dsw-alias-border-l1);\n  --pc-border-strong: var(--dsw-alias-border-l2);\n  --pc-fg: var(--dsw-alias-label-primary);\n  --pc-muted: var(--dsw-alias-label-secondary);\n  --pc-accent: var(--dsw-alias-brand-primary);\n  --pc-danger: var(--dsw-alias-state-error-primary);\n  --pc-save: #b32c48;\n  --pc-save-hover: #9c223d;\n  --pc-left-width: 320px;\n  --pc-radius: 10px;\n  --pc-radius-lg: 16px;\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  height: 100%;\n  min-width: 0;\n  min-height: 0;\n  overflow: hidden;\n  color: var(--pc-fg);\n  background: var(--pc-bg);\n  font-size: 13px;\n  line-height: 1.5;\n  container-type: inline-size;\n  outline: none;\n}\n\n.pc-root *,\n.pc-root *::before,\n.pc-root *::after {\n  box-sizing: border-box;\n}\n\n.pc-root button {\n  font: inherit;\n  color: inherit;\n}\n\n.pc-root :focus-visible {\n  outline: 1.5px solid var(--pc-accent);\n  outline-offset: 2px;\n}\n\n/* 文本输入框保持安静:focus 时不加 outline / 边框高亮,只保留光标 */\n.pc-root input:focus,\n.pc-root input:focus-visible,\n.pc-root textarea:focus,\n.pc-root textarea:focus-visible {\n  outline: none;\n}\n\n/* ---------- 共享控件 ---------- */\n\n.pc-root .pc-icon-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 30px;\n  height: 30px;\n  padding: 0;\n  flex: 0 0 auto;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--pc-muted);\n  cursor: pointer;\n  transition: background 0.14s ease, color 0.14s ease;\n}\n\n.pc-root .pc-icon-btn:hover {\n  background: var(--pc-surface-2);\n  color: var(--pc-fg);\n}\n\n.pc-root .pc-icon-btn[data-tone='danger']:hover {\n  color: var(--pc-danger);\n}\n\n.pc-root .pc-icon-btn[data-variant='solid'] {\n  background: var(--pc-surface-2);\n  color: var(--pc-fg);\n}\n\n.pc-root .pc-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  height: 30px;\n  padding: 0 12px;\n  flex: 0 0 auto;\n  border: 1px solid var(--pc-border-strong);\n  border-radius: 8px;\n  background: transparent;\n  color: var(--pc-fg);\n  font-size: 12px;\n  font-weight: 500;\n  white-space: nowrap;\n  cursor: pointer;\n  transition: background 0.14s ease, border-color 0.14s ease;\n}\n\n.pc-root .pc-btn:hover {\n  background: var(--pc-surface-2);\n}\n\n.pc-root .pc-btn:disabled {\n  opacity: 0.55;\n  cursor: default;\n}\n\n.pc-root .pc-btn-primary {\n  border-color: transparent;\n  background: var(--pc-accent);\n  color: #fff;\n}\n\n.pc-root .pc-btn-primary:hover {\n  background: var(--pc-accent);\n  filter: brightness(1.06);\n}\n\n.pc-root .pc-chip {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  height: 26px;\n  padding: 0 11px;\n  flex: 0 0 auto;\n  border: 0;\n  border-radius: 999px;\n  background: transparent;\n  color: var(--pc-muted);\n  font-size: 12px;\n  font-weight: 500;\n  white-space: nowrap;\n  cursor: pointer;\n  transition: background 0.14s ease, color 0.14s ease;\n}\n\n.pc-root .pc-chip:hover {\n  background: var(--pc-surface-2);\n  color: var(--pc-fg);\n}\n\n.pc-root .pc-chip[aria-pressed='true'] {\n  background: var(--pc-fg);\n  color: var(--pc-bg);\n}\n\n.pc-root .pc-chip[data-soft='true'] {\n  background: var(--pc-surface-2);\n  color: var(--pc-fg);\n}\n\n.pc-input {\n  width: 100%;\n  height: 30px;\n  padding: 0 9px;\n  border: 1px solid var(--pc-border-strong);\n  border-radius: 8px;\n  background: var(--pc-bg);\n  color: var(--pc-fg);\n  font: inherit;\n  font-size: 12px;\n  outline: none;\n  transition: border-color 0.14s ease;\n}\n\n.pc-input::placeholder {\n  color: var(--pc-muted);\n}\n\n.pc-scroll {\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  scrollbar-width: thin;\n  scrollbar-color: var(--pc-border-strong) transparent;\n}\n\n.pc-scroll::-webkit-scrollbar {\n  width: 8px;\n}\n\n.pc-scroll::-webkit-scrollbar-thumb {\n  border: 2px solid transparent;\n  border-radius: 999px;\n  background: var(--pc-border-strong);\n  background-clip: content-box;\n}\n\n.pc-scroll::-webkit-scrollbar-track {\n  background: transparent;\n}\n\n.pc-ellipsis {\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n.pc-skeleton {\n  border-radius: var(--pc-radius);\n  background: linear-gradient(90deg, var(--pc-surface-2) 25%, var(--pc-surface) 37%, var(--pc-surface-2) 63%);\n  background-size: 400% 100%;\n  animation: pc-shimmer 1.4s ease infinite;\n}\n\n.pc-spin {\n  animation: pc-rotate 0.9s linear infinite;\n}\n\n@keyframes pc-shimmer {\n  0% { background-position: 100% 50%; }\n  100% { background-position: 0 50%; }\n}\n\n@keyframes pc-rotate {\n  to { transform: rotate(360deg); }\n}\n\n.pc-saved-badge {\n  color: var(--pc-muted);\n  font-size: 11px;\n}\n\n/* ---------- 双栏骨架 ---------- */\n\n.pc-body {\n  display: flex;\n  flex: 1;\n  min-height: 0;\n  min-width: 0;\n}\n\n.pc-left {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  flex: 0 0 var(--pc-left-width);\n  width: var(--pc-left-width);\n  min-width: 0;\n  min-height: 0;\n  background: var(--pc-surface);\n  border-right: 1px solid var(--pc-border);\n}\n\n.pc-divider {\n  position: relative;\n  flex: 0 0 5px;\n  width: 5px;\n  cursor: col-resize;\n  touch-action: none;\n  background: transparent;\n  z-index: 6;\n}\n\n.pc-divider::after {\n  content: '';\n  position: absolute;\n  inset: 0 2px;\n  border-radius: 2px;\n  background: transparent;\n  transition: background 0.14s ease;\n}\n\n.pc-divider:hover::after,\n.pc-divider[data-dragging='true']::after {\n  background: var(--pc-accent);\n}\n\n.pc-right {\n  position: relative;\n  flex: 1;\n  min-width: 0;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n  background: var(--pc-bg);\n}\n\n/* 左侧收藏面板的结构容器:细节由 CollectionPane 的内联样式决定 */\n.pc-collection {\n  display: flex;\n  flex-direction: column;\n  height: 100%;\n  min-height: 0;\n  overflow: hidden;\n}\n\n.pc-toolbar {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  height: 44px;\n  flex: 0 0 44px;\n  padding: 0 10px 0 14px;\n}\n\n.pc-toolbar-title {\n  font-size: 13px;\n  font-weight: 600;\n  letter-spacing: 0.01em;\n}\n\n.pc-count {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-width: 18px;\n  height: 16px;\n  padding: 0 5px;\n  border-radius: 999px;\n  background: var(--pc-surface-2);\n  color: var(--pc-muted);\n  font-size: 10.5px;\n  font-variant-numeric: tabular-nums;\n}\n\n/* ---------- 浏览器(右侧 webview) ---------- */\n\n.pc-browser {\n  display: flex;\n  flex-direction: column;\n  flex: 1;\n  min-height: 0;\n  min-width: 0;\n}\n\n.pc-webview-chrome {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  height: 48px;\n  flex: 0 0 48px;\n  padding: 0 12px 0 14px;\n  border-bottom: 1px solid var(--pc-border);\n  background: var(--pc-surface);\n}\n\n.pc-address {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  flex: 1;\n  min-width: 0;\n  height: 32px;\n  padding: 0 10px;\n  border: 1px solid var(--pc-border);\n  border-radius: 999px;\n  background: var(--pc-surface-2);\n  color: var(--pc-muted);\n  transition: border-color 0.14s ease, background 0.14s ease;\n}\n\n.pc-address:focus-within {\n  background: var(--pc-bg);\n}\n\n.pc-address input {\n  flex: 1;\n  min-width: 0;\n  height: 100%;\n  border: 0;\n  background: transparent;\n  color: var(--pc-fg);\n  font: inherit;\n  font-size: 12.5px;\n  outline: none;\n}\n\n.pc-address input::placeholder {\n  color: var(--pc-muted);\n}\n\n.pc-address-tag {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  flex: 0 0 auto;\n  height: 20px;\n  padding: 0 7px;\n  border-radius: 999px;\n  background: var(--pc-bg);\n  border: 1px solid var(--pc-border);\n  color: var(--pc-muted);\n  font-size: 10.5px;\n  white-space: nowrap;\n}\n\n.pc-topic-row {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  flex: 0 0 auto;\n  padding: 8px 12px;\n  overflow-x: auto;\n  scrollbar-width: none;\n  border-bottom: 1px solid var(--pc-border);\n  background: var(--pc-bg);\n}\n\n.pc-topic-row::-webkit-scrollbar {\n  display: none;\n}\n\n.pc-feed {\n  position: relative;\n  flex: 1;\n  min-height: 0;\n  padding: 14px 16px 48px;\n}\n\n.pc-masonry {\n  column-width: 196px;\n  column-gap: 12px;\n}\n\n.pc-pin-card {\n  position: relative;\n  display: block;\n  width: 100%;\n  margin: 0 0 12px;\n  padding: 0;\n  break-inside: avoid;\n  border: 0;\n  border-radius: var(--pc-radius-lg);\n  overflow: hidden;\n  background: var(--pc-surface-2);\n  cursor: zoom-in;\n  transition: transform 0.18s ease, box-shadow 0.18s ease;\n}\n\n.pc-pin-card:hover {\n  transform: translateY(-1px);\n  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.14);\n}\n\n.pc-pin-card:active {\n  transform: none;\n}\n\n.pc-pin-media {\n  position: relative;\n  display: block;\n  width: 100%;\n  background: var(--pc-surface-2);\n  background-position: center;\n  background-size: cover;\n}\n\n.pc-pin-media img {\n  display: block;\n  width: 100%;\n  height: auto;\n  opacity: 0;\n  transition: opacity 0.25s ease;\n}\n\n.pc-pin-media img[data-loaded='true'] {\n  opacity: 1;\n}\n\n.pc-pin-fallback {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--pc-muted);\n  background: var(--pc-surface-2);\n}\n\n.pc-pin-overlay {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  flex-direction: column;\n  justify-content: space-between;\n  padding: 9px;\n  opacity: 0;\n  transition: opacity 0.16s ease;\n  background: linear-gradient(180deg, rgba(0, 0, 0, 0.34) 0%, rgba(0, 0, 0, 0.02) 34%, rgba(0, 0, 0, 0.02) 58%, rgba(0, 0, 0, 0.46) 100%);\n}\n\n.pc-pin-card:hover .pc-pin-overlay,\n.pc-pin-card:focus-visible .pc-pin-overlay {\n  opacity: 1;\n}\n\n.pc-pin-overlay-top {\n  display: flex;\n  justify-content: flex-end;\n  gap: 6px;\n}\n\n.pc-pin-overlay-bottom {\n  display: flex;\n  align-items: flex-end;\n  gap: 6px;\n}\n\n.pc-root .pc-save-pill {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  height: 30px;\n  padding: 0 13px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--pc-save);\n  color: #fff;\n  font-size: 12px;\n  font-weight: 600;\n  letter-spacing: 0.01em;\n  cursor: pointer;\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);\n  transition: background 0.14s ease, transform 0.1s ease;\n}\n\n.pc-root .pc-save-pill:hover {\n  background: var(--pc-save-hover);\n}\n\n.pc-root .pc-save-pill:active {\n  transform: scale(0.97);\n}\n\n.pc-root .pc-save-pill[data-saved='true'] {\n  background: rgba(15, 15, 18, 0.72);\n  color: #fff;\n  backdrop-filter: blur(6px);\n}\n\n.pc-root .pc-pin-open {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  padding: 0;\n  border: 0;\n  border-radius: 999px;\n  background: rgba(15, 15, 18, 0.6);\n  color: #fff;\n  cursor: pointer;\n  backdrop-filter: blur(6px);\n}\n\n.pc-root .pc-pin-open:hover {\n  background: rgba(15, 15, 18, 0.8);\n}\n\n.pc-pin-caption {\n  padding: 8px 10px 10px;\n  text-align: left;\n}\n\n.pc-pin-title {\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n  color: var(--pc-fg);\n  font-size: 12px;\n  font-weight: 600;\n  line-height: 1.42;\n  word-break: break-word;\n}\n\n.pc-pin-sub {\n  margin-top: 3px;\n  color: var(--pc-muted);\n  font-size: 11px;\n}\n\n.pc-feed-status {\n  padding: 6px 4px 22px;\n  color: var(--pc-muted);\n  font-size: 12px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n}\n\n.pc-feed-sentinel {\n  height: 1px;\n}\n\n.pc-empty {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  padding: 44px 20px;\n  text-align: center;\n  color: var(--pc-muted);\n  font-size: 12.5px;\n  line-height: 1.75;\n}\n\n.pc-empty strong {\n  color: var(--pc-fg);\n  font-size: 13.5px;\n  font-weight: 600;\n}\n\n.pc-empty-actions {\n  display: flex;\n  gap: 8px;\n  margin-top: 6px;\n  flex-wrap: wrap;\n  justify-content: center;\n}\n\n.pc-alert {\n  display: flex;\n  align-items: flex-start;\n  gap: 8px;\n  margin: 12px 4px;\n  padding: 10px 12px;\n  border: 1px solid var(--pc-border);\n  border-radius: var(--pc-radius);\n  background: var(--pc-surface);\n  color: var(--pc-muted);\n  font-size: 12px;\n  line-height: 1.6;\n}\n\n.pc-alert[data-tone='error'] {\n  border-color: color-mix(in srgb, var(--pc-danger) 42%, transparent);\n  color: var(--pc-fg);\n}\n\n.pc-alert-icon {\n  color: var(--pc-danger);\n  margin-top: 1px;\n}\n\n/* ---------- Pin 详情弹层 ---------- */\n\n.pc-detail-backdrop {\n  position: absolute;\n  inset: 0;\n  z-index: 40;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 22px;\n  background: rgba(10, 10, 14, 0.52);\n  backdrop-filter: blur(8px);\n  animation: pc-fade 0.16s ease;\n}\n\n/* 详情页(不是弹窗):占满右栏,下面接「更多类似」推荐 */\n.pc-stage {\n  position: relative;\n  flex: 1;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n}\n\n.pc-feed-layer {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  flex-direction: column;\n  min-height: 0;\n}\n\n.pc-feed-layer[data-covered='true'] {\n  pointer-events: none;\n}\n\n.pc-closeup {\n  position: absolute;\n  inset: 0;\n  z-index: 4;\n  display: flex;\n  flex-direction: column;\n  min-height: 0;\n  background: var(--pc-bg);\n  animation: pc-fade 0.16s ease;\n}\n\n.pc-closeup-bar {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  height: 44px;\n  flex: 0 0 44px;\n  padding: 0 12px;\n  border-bottom: 1px solid var(--pc-border);\n  background: var(--pc-surface);\n}\n\n.pc-closeup-hint {\n  flex: 1;\n  min-width: 0;\n  color: var(--pc-muted);\n  font-size: 11.5px;\n}\n\n.pc-closeup-scroll {\n  flex: 1;\n  min-height: 0;\n  overflow-y: auto;\n  container-type: inline-size;\n  padding: 20px 22px 48px;\n}\n\n.pc-closeup-card {\n  display: grid;\n  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);\n  width: min(980px, 100%);\n  margin: 0 auto 24px;\n  border: 1px solid var(--pc-border);\n  border-radius: 20px;\n  overflow: hidden;\n  background: var(--pc-surface);\n}\n\n.pc-closeup-media {\n  position: relative;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 240px;\n  background: #101014;\n  overflow: hidden;\n}\n\n.pc-closeup-media-zoomable {\n  cursor: zoom-in;\n}\n\n.pc-closeup-media-zoomable:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: -2px;\n}\n\n.pc-closeup-zoom {\n  position: absolute;\n  right: 10px;\n  bottom: 10px;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 4px 9px;\n  border-radius: 999px;\n  background: rgba(16, 16, 20, 0.72);\n  color: #fff;\n  font-size: 11px;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.15s ease;\n}\n\n.pc-closeup-media-zoomable:hover .pc-closeup-zoom,\n.pc-closeup-media-zoomable:focus-visible .pc-closeup-zoom {\n  opacity: 1;\n}\n\n.pc-lightbox {\n  position: fixed;\n  inset: 0;\n  z-index: 1200;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 14px;\n  padding: 28px;\n  background: rgba(10, 8, 12, 0.9);\n}\n\n.pc-lightbox-inner {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  max-width: 94vw;\n  max-height: 88vh;\n}\n\n.pc-lightbox-image {\n  display: block;\n  max-width: 94vw;\n  max-height: 88vh;\n  width: auto;\n  height: auto;\n  object-fit: contain;\n  border-radius: 10px;\n  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);\n}\n\n.pc-lightbox-caption {\n  max-width: min(720px, 90vw);\n  overflow: hidden;\n  color: rgba(255, 255, 255, 0.82);\n  font-size: 12.5px;\n  line-height: 1.5;\n  text-align: center;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.pc-lightbox-close {\n  position: absolute;\n  top: 22px;\n  right: 22px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 38px;\n  height: 38px;\n  padding: 0;\n  border: 1px solid rgba(255, 255, 255, 0.28);\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.14);\n  color: #fff;\n  cursor: pointer;\n  transition: background 0.15s ease;\n}\n\n.pc-lightbox-close:hover {\n  background: rgba(255, 255, 255, 0.24);\n}\n\n.pc-closeup-media img {\n  display: block;\n  max-width: 100%;\n  max-height: min(74vh, 680px);\n  width: auto;\n  height: auto;\n  object-fit: contain;\n}\n\n.pc-closeup-info {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  min-width: 0;\n  max-height: min(74vh, 680px);\n  padding: 20px 22px 18px;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n}\n\n.pc-closeup-title {\n  margin: 0;\n  font-size: 19px;\n  font-weight: 650;\n  line-height: 1.35;\n  word-break: break-word;\n}\n\n.pc-closeup-related {\n  width: min(980px, 100%);\n  margin: 0 auto;\n}\n\n.pc-closeup-related-head {\n  display: flex;\n  align-items: baseline;\n  gap: 10px;\n  padding: 4px 2px 12px;\n}\n\n.pc-closeup-related-head h3 {\n  margin: 0;\n  font-size: 14px;\n  font-weight: 650;\n}\n\n.pc-closeup-related-head span {\n  color: var(--pc-muted);\n  font-size: 11.5px;\n}\n\n.pc-detail-desc {\n  margin: 0;\n  color: var(--pc-muted);\n  font-size: 12.5px;\n  line-height: 1.7;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n\n.pc-detail-meta {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  padding: 8px 10px;\n  border-radius: var(--pc-radius);\n  background: var(--pc-surface-2);\n  font-size: 12px;\n}\n\n.pc-avatar {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 24px;\n  height: 24px;\n  flex: 0 0 auto;\n  border-radius: 50%;\n  background: var(--pc-bg);\n  border: 1px solid var(--pc-border);\n  color: var(--pc-muted);\n  font-size: 11px;\n  font-weight: 600;\n  text-transform: uppercase;\n}\n\n.pc-detail-meta-text {\n  display: flex;\n  flex-direction: column;\n  min-width: 0;\n  line-height: 1.4;\n}\n\n.pc-detail-meta-text strong {\n  font-size: 12px;\n  font-weight: 600;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n.pc-detail-meta-text span {\n  color: var(--pc-muted);\n  font-size: 11px;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n.pc-detail-actions {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-top: auto;\n  padding-top: 6px;\n  flex-wrap: wrap;\n}\n\n.pc-root .pc-board-select {\n  height: 32px;\n  max-width: 170px;\n  padding: 0 28px 0 10px;\n  border: 1px solid var(--pc-border-strong);\n  border-radius: 8px;\n  background-color: var(--pc-bg);\n  background-image: linear-gradient(45deg, transparent 50%, var(--pc-muted) 50%), linear-gradient(135deg, var(--pc-muted) 50%, transparent 50%);\n  background-position: calc(100% - 15px) 13px, calc(100% - 10px) 13px;\n  background-size: 5px 5px, 5px 5px;\n  background-repeat: no-repeat;\n  color: var(--pc-fg);\n  font: inherit;\n  font-size: 12px;\n  outline: none;\n  appearance: none;\n  cursor: pointer;\n}\n\n.pc-root .pc-board-select:focus {\n  border-color: var(--pc-accent);\n}\n\n.pc-root .pc-save-primary {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  height: 34px;\n  padding: 0 16px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--pc-save);\n  color: #fff;\n  font-size: 12.5px;\n  font-weight: 600;\n  cursor: pointer;\n  transition: background 0.14s ease, opacity 0.14s ease;\n}\n\n.pc-root .pc-save-primary:hover {\n  background: var(--pc-save-hover);\n}\n\n.pc-root .pc-save-primary[data-saved='true'] {\n  background: var(--pc-surface-2);\n  color: var(--pc-fg);\n  border: 1px solid var(--pc-border-strong);\n}\n\n.pc-root .pc-save-primary:disabled {\n  opacity: 0.6;\n  cursor: default;\n}\n\n.pc-detail-foot {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: var(--pc-muted);\n  font-size: 11px;\n}\n\n/* ---------- Toast ---------- */\n\n.pc-toast {\n  position: absolute;\n  left: 50%;\n  bottom: 22px;\n  z-index: 60;\n  transform: translateX(-50%);\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  max-width: min(460px, calc(100% - 32px));\n  padding: 9px 14px;\n  border: 1px solid var(--pc-border-strong);\n  border-radius: 999px;\n  background: var(--pc-overlay);\n  color: var(--pc-fg);\n  font-size: 12px;\n  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);\n  animation: pc-toast-in 0.2s ease;\n}\n\n.pc-toast-dot {\n  width: 6px;\n  height: 6px;\n  flex: 0 0 auto;\n  border-radius: 50%;\n  background: var(--pc-save);\n}\n\n.pc-toast[data-tone='error'] .pc-toast-dot {\n  background: var(--pc-danger);\n}\n\n/* ---------- 动效 ---------- */\n\n@keyframes pc-fade {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}\n\n@keyframes pc-pop {\n  from { opacity: 0; transform: translateY(6px) scale(0.985); }\n  to { opacity: 1; transform: translateY(0) scale(1); }\n}\n\n@keyframes pc-toast-in {\n  from { opacity: 0; transform: translate(-50%, 8px); }\n  to { opacity: 1; transform: translate(-50%, 0); }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .pc-root *,\n  .pc-root *::before,\n  .pc-root *::after {\n    animation-duration: 0.001ms !important;\n    animation-iteration-count: 1 !important;\n    transition-duration: 0.001ms !important;\n  }\n}\n\n/* ---------- macOS 隐藏标题栏:让工具条直接长在标题栏里 ----------\n * 侧栏折叠后主面板贴到窗口左上角,系统红绿灯和 Harness 的侧栏把手\n * (layout 的 leadingSeat,left:88px / top:11px)会压住第一行工具条。\n * 官方面板的做法是「内容不往下让,而是横向让位」:layout 暴露了\n * --dsh-frame-top-clearance(darwin 48px)和 --dsh-frame-leading-clearance\n * (折侧栏时 160px,展开时为 0)。所以这里:\n *   1. 左栏工具条整行留在窗口 chrome 高度内,标题横向缩进到把手右边;\n *   2. 右栏地址栏本来就是 48px,不额外留白,直接铺满这条标题栏;\n *   3. 两条工具条都设为窗口拖动区,按钮/输入框保持 no-drag。\n * 这样左右两栏顶部都没有空白,只有红绿灯/把手所在的那一条被真实内容占用。\n */\nhtml[data-platform='darwin']:not([data-fullscreen]) .pc-root[data-window-edge='true'] .pc-collection-toolbar {\n  /* 让位宽度来自 layout:侧栏折叠时 160px(全屏时 layout 会给 84px,此处不生效) */\n  padding-left: max(14px, calc(var(--dsh-frame-leading-clearance, 160px) - 8px));\n  /* 右栏地址栏是 48px,左栏工具条也拉齐到 48px,两栏行高一致 */\n  height: 48px !important;\n  flex-basis: 48px !important;\n  -webkit-app-region: drag;\n}\n\nhtml[data-platform='darwin']:not([data-fullscreen]) .pc-root[data-window-edge='true'] .pc-webview-chrome {\n  -webkit-app-region: drag;\n}\n\n.pc-address {\n  -webkit-app-region: no-drag;\n}\n\n.pc-root button,\n.pc-root input,\n.pc-root textarea,\n.pc-root select,\n.pc-root a {\n  -webkit-app-region: no-drag;\n}\n\n/* ---------- 窄容器:上下分栏 ---------- */\n\n@container (max-width: 780px) {\n  .pc-body {\n    flex-direction: column;\n  }\n\n  .pc-left {\n    flex: 0 0 42%;\n    width: 100%;\n    height: 42%;\n    border-right: 0;\n    border-bottom: 1px solid var(--pc-border);\n  }\n\n  .pc-divider {\n    display: none;\n  }\n\n  .pc-masonry {\n    column-width: 150px;\n  }\n\n  .pc-closeup-card {\n    grid-template-columns: minmax(0, 1fr);\n  }\n\n  .pc-closeup-media img {\n    max-height: 42vh;\n  }\n\n  .pc-closeup-info {\n    max-height: none;\n  }\n}\n\n/* ---------- 账号态 / 推荐流 / 登录弹层(1.1) ---------- */\n\n.pc-account-bar {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  height: 34px;\n  flex: 0 0 34px;\n  padding: 0 12px;\n  border-bottom: 1px solid var(--pc-border);\n  background: var(--pc-surface);\n  font-size: 11.5px;\n  color: var(--pc-muted);\n}\n\n.pc-account-dot {\n  width: 6px;\n  height: 6px;\n  flex: 0 0 auto;\n  border-radius: 50%;\n  background: var(--dsw-alias-state-idle-primary);\n  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-idle-primary) 16%, transparent);\n}\n\n.pc-account-dot[data-on='true'] {\n  background: var(--dsw-alias-state-success-primary);\n  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary) 18%, transparent);\n}\n\n.pc-account-text {\n  flex: 1;\n  min-width: 0;\n  color: var(--pc-muted);\n}\n\n.pc-feed-mode {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 0 2px 10px;\n}\n\n.pc-feed-mode-query {\n  min-width: 0;\n  color: var(--pc-muted);\n  font-size: 11.5px;\n}\n\n.pc-feed-notice {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin: 10px 2px;\n  padding: 9px 12px;\n  border: 1px solid color-mix(in srgb, var(--pc-danger) 38%, transparent);\n  border-radius: var(--pc-radius);\n  background: var(--pc-surface);\n  color: var(--pc-fg);\n  font-size: 12px;\n}\n\n.pc-login-card {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  width: min(560px, 100%);\n  max-height: 100%;\n  overflow: hidden;\n  border-radius: 18px;\n  background: var(--pc-surface);\n  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.36);\n  animation: pc-pop 0.18s ease;\n}\n\n.pc-login-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 13px 14px 11px 18px;\n  border-bottom: 1px solid var(--pc-border);\n}\n\n.pc-login-badge {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 26px;\n  height: 26px;\n  flex: 0 0 auto;\n  border-radius: 8px;\n  background: var(--pc-save);\n  color: #fff;\n}\n\n.pc-login-title {\n  margin: 0;\n  font-size: 15px;\n  font-weight: 650;\n  letter-spacing: 0.01em;\n}\n\n.pc-login-tabs {\n  display: flex;\n  gap: 4px;\n  padding: 10px 18px 0;\n}\n\n.pc-login-error {\n  margin: 0 18px;\n}\n\n.pc-login-pane {\n  min-height: 0;\n  padding: 14px 18px 16px;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n}\n\n.pc-login-lead {\n  margin: 0;\n  color: var(--pc-muted);\n  font-size: 12.5px;\n  line-height: 1.75;\n}\n\n.pc-login-actions {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n\n.pc-login-status {\n  display: flex;\n  align-items: flex-start;\n  gap: 9px;\n  padding: 10px 12px;\n  border: 1px solid var(--pc-border);\n  border-radius: var(--pc-radius);\n  background: var(--pc-surface-2);\n  font-size: 12px;\n  color: var(--pc-fg);\n}\n\n.pc-login-status .pc-spin {\n  margin-top: 2px;\n  color: var(--pc-muted);\n}\n\n.pc-login-status strong {\n  display: block;\n  font-size: 12px;\n  font-weight: 600;\n}\n\n.pc-login-status-msg {\n  display: block;\n  margin-top: 2px;\n  color: var(--pc-muted);\n  font-size: 11.5px;\n  line-height: 1.6;\n  word-break: break-word;\n}\n\n.pc-login-steps {\n  margin: 0;\n  padding-left: 18px;\n  color: var(--pc-muted);\n  font-size: 12px;\n  line-height: 1.9;\n}\n\n.pc-login-steps li {\n  padding-left: 2px;\n}\n\n.pc-login-textarea {\n  height: auto;\n  min-height: 84px;\n  padding: 8px 10px;\n  resize: vertical;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 11.5px;\n  line-height: 1.65;\n}\n\n.pc-login-note {\n  margin: 0;\n  color: var(--pc-muted);\n  font-size: 11px;\n  line-height: 1.75;\n}\n\n.pc-login-foot {\n  margin: 0;\n  padding: 10px 18px 13px;\n  border-top: 1px solid var(--pc-border);\n  color: var(--pc-muted);\n  font-size: 11px;\n  line-height: 1.7;\n}\n\n.pc-login-empty {\n  padding-top: 46px;\n}\n\n.pc-login-empty-icon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 54px;\n  height: 54px;\n  margin-bottom: 4px;\n  border-radius: 16px;\n  background: var(--pc-surface-2);\n  color: var(--pc-save);\n}\n\n.pc-login-empty-hint {\n  margin-top: 2px;\n  color: var(--pc-muted);\n  font-size: 11px;\n}\n\n@container (max-width: 780px) {\n  .pc-login-card {\n    width: 100%;\n  }\n\n  .pc-account-bar {\n    font-size: 11px;\n  }\n}\n\n/* ---------- 账号头像 / 设置页 ---------- */\n\n.pc-browser {\n  position: relative;\n}\n\n.pc-avatar-circle {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  flex: 0 0 auto;\n  overflow: hidden;\n  border: 1px solid var(--pc-border);\n  background: var(--pc-surface-2);\n  color: var(--pc-muted);\n  font-weight: 600;\n  object-fit: cover;\n  line-height: 1;\n  text-transform: uppercase;\n}\n\n.pc-account-name {\n  max-width: 132px;\n  flex: 0 1 auto;\n  color: var(--pc-fg);\n  font-size: 11.5px;\n  font-weight: 650;\n}\n\n.pc-account-bar .pc-avatar-circle {\n  box-shadow: 0 0 0 2px var(--pc-surface);\n}\n\n/* 设置页:占满右栏的一页(不是弹窗) */\n.pc-settings-page {\n  position: absolute;\n  inset: 0;\n  z-index: 30;\n  display: flex;\n  flex-direction: column;\n  min-height: 0;\n  background: var(--pc-bg);\n  animation: pc-fade 0.16s ease;\n}\n\n.pc-settings-page-bar {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  height: 48px;\n  flex: 0 0 48px;\n  padding: 0 14px;\n  border-bottom: 1px solid var(--pc-border);\n  background: var(--pc-surface);\n}\n\n.pc-settings-page-title {\n  font-size: 14px;\n  font-weight: 650;\n  letter-spacing: 0.01em;\n}\n\n.pc-settings-page-scroll {\n  flex: 1;\n  min-height: 0;\n  overflow-y: auto;\n  padding: 22px 24px 56px;\n}\n\n.pc-settings-wrap {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  width: min(720px, 100%);\n  margin: 0 auto;\n}\n\n.pc-settings-account {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 10px 12px;\n  border-radius: 10px;\n  background: var(--pc-surface-2);\n}\n\n.pc-settings-account-text {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  flex: 1;\n  min-width: 0;\n}\n\n.pc-settings-account-text strong {\n  font-size: 13px;\n  font-weight: 650;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.pc-settings-account-text span {\n  color: var(--pc-muted);\n  font-size: 11.5px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n/* 分段切换:做成明显的实心选中块,而不是弱化 chip */\n.pc-root .pc-segment {\n  display: inline-flex;\n  gap: 4px;\n  padding: 4px;\n  border: 1px solid var(--pc-border-strong);\n  border-radius: 11px;\n  background: var(--pc-surface-2);\n}\n\n.pc-root .pc-segment button {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  height: 32px;\n  padding: 0 16px;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--pc-muted);\n  font-size: 12.5px;\n  font-weight: 600;\n  cursor: pointer;\n  transition: background 0.14s ease, color 0.14s ease, box-shadow 0.14s ease;\n}\n\n.pc-root .pc-segment button:hover {\n  color: var(--pc-fg);\n  background: var(--pc-surface);\n}\n\n.pc-root .pc-segment button[aria-pressed='true'] {\n  background: var(--pc-fg);\n  color: var(--pc-bg);\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);\n}\n\n.pc-root .pc-segment button[aria-pressed='true']:hover {\n  background: var(--pc-fg);\n  color: var(--pc-bg);\n}\n\n.pc-settings-list {\n  margin: 0;\n  padding: 0;\n  list-style: none;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.pc-settings-list li {\n  display: flex;\n  align-items: baseline;\n  gap: 12px;\n  font-size: 12px;\n  line-height: 1.6;\n}\n\n.pc-settings-list li > span:first-child {\n  flex: 0 0 64px;\n  color: var(--pc-muted);\n}\n\n.pc-settings-list code {\n  padding: 1px 6px;\n  border-radius: 5px;\n  background: var(--pc-surface-2);\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 11px;\n}\n\n.pc-settings-export {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  margin-top: 12px;\n  flex-wrap: wrap;\n}\n\n.pc-settings-export-btn {\n  height: 30px;\n  padding: 0 12px;\n  font-size: 12px;\n}\n\n.pc-settings-export .pc-settings-hint {\n  flex: 1 1 200px;\n  min-width: 0;\n}\n\n.pc-settings-links {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  margin-top: 14px;\n  padding-top: 14px;\n  border-top: 1px solid var(--pc-border);\n}\n\n.pc-settings-link {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 8px 10px;\n  border: 1px solid var(--pc-border);\n  border-radius: 8px;\n  background: var(--pc-surface);\n  color: var(--pc-fg);\n  font-size: 12.5px;\n  line-height: 1.5;\n  text-decoration: none;\n}\n\n.pc-settings-link:hover {\n  background: var(--pc-surface-2);\n}\n\n.pc-settings-link svg {\n  flex: 0 0 auto;\n  color: var(--pc-muted);\n}\n\n.pc-settings-link-label {\n  flex: 0 0 auto;\n  font-weight: 600;\n}\n\n.pc-settings-link-url {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  color: var(--pc-muted);\n  font-size: 11.5px;\n  text-align: right;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n@container (max-width: 560px) {\n  .pc-settings-link-url {\n    display: none;\n  }\n}\n\n@container (max-width: 780px) {\n  .pc-settings-page-scroll {\n    padding: 16px 14px 40px;\n  }\n\n  .pc-settings-account {\n    flex-wrap: wrap;\n  }\n\n  .pc-root .pc-segment {\n    width: 100%;\n  }\n\n  .pc-root .pc-segment button {\n    flex: 1;\n    justify-content: center;\n    padding: 0 8px;\n  }\n}\n\n\n/* ---------- 收藏夹命名弹层 ---------- */\n\n.pc-name-dialog {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  width: min(320px, 100%);\n  padding: 16px 16px 14px;\n  border: 1px solid var(--pc-border);\n  border-radius: 14px;\n  background: var(--pc-surface);\n  box-shadow: 0 22px 50px rgba(0, 0, 0, 0.32);\n  animation: pc-pop 0.16s ease;\n}\n\n.pc-name-dialog-title {\n  margin: 0;\n  font-size: 13.5px;\n  font-weight: 650;\n}\n\n.pc-name-dialog .pc-input {\n  height: 34px;\n  font-size: 13px;\n}\n\n.pc-name-dialog-error {\n  margin: 0;\n  color: var(--pc-danger);\n  font-size: 11.5px;\n}\n\n.pc-name-dialog-actions {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n  gap: 8px;\n}\n\n/* ---------- 账号入口 / 账号页 ---------- */\n\n.pc-account-identity {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  max-width: 210px;\n  flex: 0 1 auto;\n  padding: 2px 8px 2px 2px;\n  border: 0;\n  border-radius: 999px;\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n  transition: background 0.14s ease;\n}\n\n.pc-root .pc-account-identity:hover {\n  background: var(--pc-surface-2);\n}\n\n.pc-account-hero {\n  display: flex;\n  align-items: center;\n  gap: 14px;\n  padding: 18px;\n  border: 1px solid var(--pc-border);\n  border-radius: 16px;\n  background: var(--pc-surface);\n}\n\n.pc-account-hero-text {\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  min-width: 0;\n}\n\n.pc-account-hero-text strong {\n  font-size: 17px;\n  font-weight: 650;\n  line-height: 1.3;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.pc-account-hero-text span {\n  color: var(--pc-muted);\n  font-size: 12px;\n  line-height: 1.5;\n}\n\n.pc-account-hero-meta {\n  font-variant-numeric: tabular-nums;\n}\n\n.pc-account-page .pc-settings-wrap {\n  width: min(980px, 100%);\n}\n\n.pc-account-grid-head {\n  display: flex;\n  align-items: baseline;\n  gap: 10px;\n  margin: 18px 2px 10px;\n}\n\n.pc-account-grid-head h3 {\n  margin: 0;\n  font-size: 14px;\n  font-weight: 650;\n}\n\n.pc-account-grid-head span {\n  color: var(--pc-muted);\n  font-size: 11.5px;\n}\n\n/* ---------- 相关 App 推荐位(设置页) ---------- */\n\n.pc-root .pc-promo {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 10px 12px;\n  border: 1px solid var(--pc-border);\n  border-radius: 12px;\n  background: var(--pc-surface-2);\n  color: var(--pc-fg);\n  text-decoration: none;\n  transition: background 0.14s ease, border-color 0.14s ease, transform 0.14s ease;\n}\n\n.pc-root .pc-promo:hover {\n  background: var(--pc-surface);\n  border-color: var(--pc-border-strong);\n  transform: translateY(-1px);\n}\n\n.pc-promo-icon {\n  width: 48px;\n  height: 48px;\n  flex: 0 0 auto;\n  border-radius: 12px;\n  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.16);\n}\n\n.pc-promo-text {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  flex: 1;\n  min-width: 0;\n}\n\n.pc-promo-text strong {\n  font-size: 12.5px;\n  font-weight: 650;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.pc-promo-text span {\n  color: var(--pc-muted);\n  font-size: 11.5px;\n  line-height: 1.55;\n}\n\n.pc-promo-meta {\n  font-variant-numeric: tabular-nums;\n}\n\n.pc-promo-cta {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  flex: 0 0 auto;\n  height: 28px;\n  padding: 0 10px;\n  border: 1px solid var(--pc-border-strong);\n  border-radius: 999px;\n  color: var(--pc-fg);\n  font-size: 11.5px;\n  font-weight: 600;\n}\n\n/* ---------- 设置页:双栏(左导航 + 右详情) ---------- */\n\n.pc-settings-page {\n  container-type: inline-size;\n}\n\n.pc-settings-body {\n  display: flex;\n  flex: 1;\n  min-height: 0;\n}\n\n.pc-settings-nav {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  width: 176px;\n  flex: 0 0 176px;\n  padding: 12px 10px;\n  border-right: 1px solid var(--pc-border);\n  background: var(--pc-surface);\n  overflow-y: auto;\n}\n\n.pc-settings-nav-title {\n  padding: 2px 10px 8px;\n  color: var(--pc-muted);\n  font-size: 10.5px;\n  font-weight: 650;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\n.pc-root .pc-settings-nav-item {\n  display: flex;\n  align-items: center;\n  gap: 9px;\n  height: 36px;\n  padding: 0 10px;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--pc-muted);\n  font-size: 12.5px;\n  font-weight: 600;\n  text-align: left;\n  cursor: pointer;\n  transition: background 0.14s ease, color 0.14s ease;\n}\n\n.pc-root .pc-settings-nav-item:hover {\n  background: var(--pc-surface-2);\n  color: var(--pc-fg);\n}\n\n/* 选中态:品牌色浅色调的胶囊;不用左侧竖条(视觉噪音大,也不符合 macOS 设置列表的习惯) */\n.pc-root .pc-settings-nav-item[aria-current='page'] {\n  background: color-mix(in srgb, var(--pc-accent) 13%, var(--pc-surface));\n  color: var(--pc-fg);\n  font-weight: 650;\n  box-shadow: none;\n}\n\n.pc-root .pc-settings-nav-item[aria-current='page']:hover {\n  background: color-mix(in srgb, var(--pc-accent) 18%, var(--pc-surface));\n}\n\n.pc-root .pc-settings-nav-item[aria-current='page'] svg {\n  color: var(--pc-accent);\n}\n\n.pc-settings-detail {\n  flex: 1;\n  min-width: 0;\n  min-height: 0;\n  overflow-y: auto;\n  padding: 24px 26px 48px;\n}\n\n.pc-settings-detail-card {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  width: min(680px, 100%);\n  margin: 0 auto;\n}\n\n.pc-settings-detail-head {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.pc-settings-detail-title {\n  margin: 0;\n  color: var(--pc-fg);\n  font-size: 17px;\n  font-weight: 650;\n  line-height: 1.35;\n}\n\n.pc-settings-hint {\n  margin: 0;\n  color: var(--pc-muted);\n  font-size: 11.5px;\n  line-height: 1.7;\n}\n\n.pc-settings-detail-desc {\n  margin: 0;\n  color: var(--pc-muted);\n  font-size: 12px;\n  line-height: 1.7;\n}\n\n.pc-settings-actions {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n\n.pc-settings-promo {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding-top: 16px;\n  border-top: 1px solid var(--pc-border);\n}\n\n.pc-settings-promo-title {\n  margin: 0;\n  color: var(--pc-fg);\n  font-size: 12.5px;\n  font-weight: 650;\n}\n\n@container (max-width: 560px) {\n  .pc-settings-body {\n    flex-direction: column;\n  }\n\n  .pc-settings-nav {\n    width: 100%;\n    flex: 0 0 auto;\n    flex-direction: row;\n    gap: 4px;\n    padding: 8px;\n    border-right: 0;\n    border-bottom: 1px solid var(--pc-border);\n    overflow-x: auto;\n    overflow-y: hidden;\n  }\n\n  .pc-settings-nav-title {\n    display: none;\n  }\n\n  .pc-root .pc-settings-nav-item {\n    flex: 0 0 auto;\n    height: 32px;\n    padding: 0 12px;\n  }\n\n  .pc-root .pc-settings-nav-item[aria-current='page'] {\n    box-shadow: none;\n  }\n\n  .pc-settings-detail {\n    padding: 16px 14px 40px;\n  }\n}\n\n/* ---------- 收藏备注(为什么收藏它) ---------- */\n\n.pc-note {\n  margin-top: 10px;\n}\n\n.pc-note-read {\n  display: flex;\n  align-items: flex-start;\n  gap: 6px;\n  padding: 8px 10px;\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-2);\n}\n\n.pc-note-glyph {\n  flex: 0 0 auto;\n  margin-top: 2px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.pc-note-text {\n  flex: 1 1 auto;\n  min-width: 0;\n  margin: 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12.5px;\n  line-height: 1.55;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n}\n\n.pc-note-edit {\n  flex: 0 0 auto;\n  padding: 0 2px;\n  border: 0;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font: inherit;\n  font-size: 12px;\n  line-height: 1.6;\n  cursor: pointer;\n}\n\n.pc-note-edit:hover {\n  color: var(--dsw-alias-label-primary);\n}\n\n.pc-note-add {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 6px 10px;\n  border: 1px dashed var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font: inherit;\n  font-size: 12.5px;\n  cursor: pointer;\n}\n\n.pc-note-add:hover {\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n}\n\n.pc-note-editor {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.pc-note-input {\n  width: 100%;\n  box-sizing: border-box;\n  min-height: 58px;\n  padding: 8px 10px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 12.5px;\n  line-height: 1.5;\n  resize: vertical;\n}\n\n.pc-note-input::placeholder {\n  color: var(--dsw-alias-label-secondary);\n  opacity: 0.75;\n}\n\n.pc-note-input:focus {\n  outline: none;\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.pc-note-input-single {\n  min-height: 32px;\n  height: 32px;\n  padding: 0 10px;\n  resize: none;\n}\n\n.pc-note-editor-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 6px;\n}\n\n.pc-note-save {\n  height: 28px;\n  padding: 0 12px;\n  font-size: 12px;\n}\n\n.pc-collection-pin-note {\n  margin-top: 4px;\n  padding: 5px 7px;\n  border-radius: 7px;\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-secondary);\n  font-size: 11.5px;\n  line-height: 1.5;\n  display: -webkit-box;\n  -webkit-line-clamp: 3;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n  overflow-wrap: anywhere;\n}";

// ---- src/client/parts/00-shared.js ----
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
  download: [
    ['path', { d: 'M12 4v10' }],
    ['path', { d: 'm7.6 10.4 4.4 4.4 4.4-4.4' }],
    ['path', { d: 'M5 19.2h14' }]
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

// ---- src/client/parts/10-collection.js ----
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
    meta ? h('div', { className: 'pc-pin-sub pc-ellipsis' }, meta) : null,
    pin.note ? h('div', { className: 'pc-collection-pin-note', title: pin.note }, pin.note) : null
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
        const note = String(pin.note || '').toLowerCase()
        return title.indexOf(term) !== -1 || description.indexOf(term) !== -1 || note.indexOf(term) !== -1
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

// ---- src/client/parts/14-i18n.js ----
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

// ---- src/client/parts/16-i18n-collection.js ----
/* eslint-disable */
/** 左侧收藏面板（CollectionPane）的英文词典。key 为中文原文，与 pcT 第一个参数逐字一致。 */
pcAddDict({
  '未命名收藏夹': 'Untitled board',
  '{name}，{count} 个收藏': '{name}, {count} saves',
  '收藏夹「{name}」更多操作': 'More actions for board "{name}"',
  '更多操作': 'More actions',
  '未命名收藏': 'Untitled save',
  '视频': 'Video',
  '打开收藏详情': 'Open save details',
  '打开': 'Open',
  '取消收藏': 'Unsave',
  '打开收藏：{name}': 'Open save: {name}',
  '收藏夹「{name}」操作': 'Board "{name}" actions',
  '重命名收藏夹': 'Rename board',
  '再次点击确认删除': 'Click again to confirm deletion',
  '删除收藏夹': 'Delete board',
  '还没有收藏。到右侧浏览 Pinterest，点 ♥ 就会出现在这里。': 'No saves yet. Browse Pinterest on the right and click ♥ to save pins here.',
  '这个收藏夹还是空的。到右侧浏览 Pinterest，点 ♥ 收藏就会进到这里。': 'This board is still empty. Browse Pinterest on the right and click ♥ to save pins here.',
  '没有找到匹配「{query}」的收藏。': 'No saves matching "{query}".',
  '清除搜索': 'Clear search',
  '正在加载收藏…': 'Loading saves…',
  '新建收藏夹，输入名称：': 'New board — enter a name:',
  '收藏夹名称不能为空': 'Board name cannot be empty',
  '收藏夹名称': 'Board name',
  '取消': 'Cancel',
  '创建': 'Create',
  '保存': 'Save',
  '我的收藏': 'My saves',
  '共 {n} 个收藏': '{n} saves',
  '新建收藏夹': 'New board',
  '全部': 'All',
  '搜索收藏': 'Search saves',
  '重试加载收藏': 'Retry loading saves',
  '重试': 'Retry'
})

// ---- src/client/parts/17-i18n-app.js ----
/* eslint-disable */
/**
 * 右栏浏览 / 登录弹层 / Pin 详情(20-browser.js、25-login.js、30-detail.js)的英文词典。
 * key 与 pcT() 的第一参数逐字一致;占位符形如 {query}。只收录这三个文件实际用到的 key。
 */
pcAddDict({
  '查看 Pin:{title}': 'View Pin: {title}',
  '查看大图': 'View larger',
  '关闭预览': 'Close preview',
  '图片预览': 'Image preview',
  '取消收藏': 'Unsave',
  '收藏到我的收藏': 'Save to my saves',
  '保存中': 'Saving',
  '为什么收藏它?(可选)': 'Why did you save it? (optional)',
  '收藏备注': 'Note',
  '记一句为什么收藏它': 'Add a note: why did you save it?',
  '编辑备注': 'Edit note',
  '编辑': 'Edit',
  '保存备注': 'Save note',
  '备注已保存': 'Note saved',
  '备注保存失败': "Couldn't save the note",
  '已收藏': 'Saved',
  '收藏': 'Save',
  '打开 Pin 详情': 'Open Pin details',
  '来自 {site}': 'From {site}',
  'Pinterest 登录已失效': 'Your Pinterest login has expired',
  '加载失败了': 'Failed to load',
  '继续加载失败': 'Failed to load more',
  '插件的 Host 还是旧版本,重启一次 DeepSeek Harness 后就能登录 Pinterest': 'The plugin\'s Host is still an old version. Restart DeepSeek Harness once to log in to Pinterest.',
  '单条 Pin 链接要登录态才读得到,换成关键词浏览吧': 'A single Pin link needs a login to load. Try browsing with keywords instead.',
  '这个链接里没有可浏览的关键词,换个搜索试试': 'This link has no browsable keywords. Try another search.',
  '推荐流已恢复': 'Your feed is back',
  '还是读不到推荐,可能需要重新登录一次': 'Still can\'t load your feed. You may need to log in again.',
  '重新校验失败': 'Re-verification failed',
  '已退出 Pinterest 登录': 'Logged out of Pinterest',
  '退出登录失败': 'Failed to log out',
  '登录与推荐需要重启一次 Harness': 'Restart Harness to enable login and feed',
  '插件的浏览器侧已经更新,但 Host 半的 JS 在进程内只加载一次。退出并重新打开 DeepSeek Harness 后,这里会出现「登录 Pinterest」和为你推荐的首页流。': 'The browser side of the plugin is already updated, but the Host-side JS only loads once per process. Quit and reopen DeepSeek Harness, and "Log in to Pinterest" plus your personalized home feed will appear here.',
  '重新检查': 'Check again',
  '现在仍然可以在上方地址栏搜索并收藏 Pin。': 'You can still search and save Pins from the address bar above.',
  '登录后,这里是你专属的推荐流': 'Log in to see your personal feed here',
  'Pinterest 的推荐依赖你的登录态。连接账号后,右侧会直接显示按你口味生成的首页推荐,而不是通用分类。': 'Pinterest recommendations depend on your login. Once you connect your account, this panel shows a home feed tailored to your taste instead of generic categories.',
  '登录 Pinterest': 'Log in to Pinterest',
  '在上方地址栏输入关键词,不登录也可以搜索 Pinterest': 'Type keywords in the address bar above to search Pinterest without logging in',
  '改用搜索': 'Search instead',
  '会用独立 Chrome 窗口登录,不会动你日常浏览器的登录状态。': 'Logging in uses a separate Chrome window and won\'t touch your daily browser\'s login state.',
  '可以粘贴浏览器里的 cookie 完成连接。': 'You can paste the cookie from your browser to connect.',
  '已登录,但这次没读到推荐流': 'Logged in, but your feed couldn\'t load this time',
  'Pinterest 没返回推荐内容,可能是接口调整或临时风控。先点「重新校验」,不行再重新连接一次。': 'Pinterest didn\'t return feed content - it may be an API change or a temporary anti-bot check. Click "Verify again" first; if that doesn\'t work, reconnect once.',
  'Pinterest 让这次请求失效了,通常是登录过期或被风控。重新连接一次即可。': 'Pinterest invalidated this request, usually because the login expired or was flagged. Reconnecting once should fix it.',
  '重新校验': 'Verify again',
  '重新连接': 'Reconnect',
  '重试': 'Retry',
  '没连上 Pinterest': 'Couldn\'t connect to Pinterest',
  '网络或接口暂时不可用': 'The network or API is temporarily unavailable',
  '账号设置': 'Account settings',
  '没有找到相关 Pin': 'No matching Pins found',
  '推荐流暂时是空的': 'Your feed is empty for now',
  '换一个关键词试试,或者返回你的推荐流。': 'Try another keyword, or go back to your feed.',
  'Pinterest 这会儿没给内容,过一会儿点刷新再看看。': 'Pinterest didn\'t return anything right now. Refresh in a moment and check again.',
  '返回推荐': 'Back to feed',
  '刷新': 'Refresh',
  '搜索 Pinterest,或直接回车回到推荐': 'Search Pinterest, or press Enter to return to your feed',
  '搜索 Pinterest,或粘贴 pinterest.com 链接': 'Search Pinterest, or paste a pinterest.com link',
  'Pinterest 地址栏': 'Pinterest address bar',
  '解析': 'Resolving',
  '已登录': 'Logged in',
  '未登录': 'Not logged in',
  '执行搜索': 'Run search',
  '换一批搜索结果': 'Load more results',
  '刷新推荐': 'Refresh feed',
  '在 Pinterest 官网打开': 'Open on Pinterest',
  '搜索「{query}」· 已登录,结果按你的画像排序': 'Search "{query}" · Logged in, results ranked by your profile',
  '已连接 Pinterest · 推荐按你的口味生成': 'Pinterest connected · Feed tailored to your taste',
  'Host 需要重启一次 Harness 才能登录 Pinterest': 'Restart Harness once so the Host can log in to Pinterest',
  'Pinterest 登录已过期,重新连接后推荐会恢复': 'Your Pinterest login has expired. Reconnect to restore your feed.',
  '未登录 · 登录后这里是你专属的推荐流': 'Not logged in · Log in to see your personal feed here',
  '推荐': 'For you',
  '账号': 'Account',
  '登录': 'Log in',
  '搜索「{query}」': 'Search "{query}"',
  '正在加载更多 Pin': 'Loading more Pins',
  '已经到底了 · 换个关键词继续逛': 'You\'ve reached the end · Try another keyword',
  '推荐到头了 · 点右上角刷新换一批': 'You\'ve reached the end · Refresh at the top right for more',
  '已连接 Pinterest,推荐已就绪': 'Pinterest connected. Your feed is ready.',
  '登录没有完成,可以再试一次': 'Login didn\'t finish. You can try again.',
  '查询登录状态失败': 'Failed to check login status',
  '打不开 Chrome 登录窗口': 'Couldn\'t open the Chrome login window',
  '正在读取登录态…': 'Reading your login session…',
  '继续失败,请重试': 'Couldn\'t continue. Please try again.',
  '先把 cookie 粘贴进来': 'Paste your cookie first',
  '已连接 Pinterest 账号': 'Pinterest account connected',
  'Cookie 校验没有通过': 'Cookie verification failed',
  '点下面的按钮会打开一个独立的 Chrome 窗口,在里面正常登录 Pinterest(继续用 Google 登录也可以:这个窗口不带调试端口,Google 不会判成不安全浏览器)。登录完成、看到 Pinterest 首页后,点下面的「我已完成登录,继续」;或者直接按 ⌘Q 退出那个 Chrome 窗口,插件都会自动读取登录态。': 'Clicking the button below opens a separate Chrome window where you log in to Pinterest normally (continuing with Google login also works: this window has no debugging port, so Google won\'t treat it as an insecure browser). Once you\'ve logged in and see the Pinterest home page, click "I\'ve logged in, continue" below - or just press ⌘Q to quit that Chrome window. Either way, the plugin reads your login session automatically.',
  '这台机器上没有找到 Chrome,请用右边的「粘贴 Cookie」方式连接。': 'Chrome wasn\'t found on this machine. Use "Paste Cookie" on the right to connect.',
  '处理中…': 'Working…',
  '我已完成登录,继续': 'I\'ve logged in, continue',
  '打开 Chrome 登录窗口': 'Open Chrome login window',
  '取消': 'Cancel',
  '请在 Chrome 窗口里完成登录': 'Finish logging in in the Chrome window',
  '登录完成后点「我已完成登录,继续」或按 ⌘Q 退出 Chrome': 'When done, click "I\'ve logged in, continue" or press ⌘Q to quit Chrome',
  '登录窗口用的是独立 Chrome 配置(不会碰你日常浏览器的登录状态),并且**不开调试端口**——带调试端口的新版 Chrome 会把 navigator.webdriver 置为 true,Google 会因此拒绝登录。读取 cookie 是等你关掉窗口后用一个 headless 实例单独完成的,不会碰 Google 页面。登录后的 cookie 只保存在本机,插件不会读取或上传你的账号密码。': 'The login window uses a separate Chrome profile (your daily browser\'s login state is untouched) and runs **without a debugging port** - newer Chrome versions with a debugging port set navigator.webdriver to true, which makes Google reject the login. Cookies are read afterwards by a separate headless instance, so Google\'s pages are never touched. Your login cookie is stored only on this machine; the plugin never reads or uploads your account password.',
  '在浏览器里打开 pinterest.com 并登录。': 'Open pinterest.com in your browser and log in.',
  '按 F12 打开开发者工具 → Application(应用) → Cookies → https://www.pinterest.com。': 'Press F12 to open DevTools → Application → Cookies → https://www.pinterest.com.',
  '找到 `_pinterest_sess`、`csrftoken`、`_auth` 三个值,拼成一行:`_pinterest_sess=…; csrftoken=…; _auth=1`。': 'Find the `_pinterest_sess`, `csrftoken` and `_auth` values and join them into one line: `_pinterest_sess=…; csrftoken=…; _auth=1`.',
  '粘贴到下面,点「验证并保存」。': 'Paste it below and click "Verify and save".',
  '粘贴 Pinterest cookie': 'Paste Pinterest cookie',
  '校验中…': 'Verifying…',
  '验证并保存': 'Verify and save',
  'Cookie 等同于登录凭证:它只会写入本机 ~/.dsh/pinterest-collect/session.json(权限 600),用于读取你自己的推荐流;插件不会把它发到 Pinterest 以外的任何地方,随时可以在这里退出登录。': 'A cookie is equivalent to a login credential: it is written only to ~/.dsh/pinterest-collect/session.json on this machine (mode 600) and used to read your own feed. The plugin never sends it anywhere other than Pinterest, and you can log out here at any time.',
  '连接 Pinterest 账号': 'Connect Pinterest account',
  'Pinterest 账号': 'Pinterest account',
  '关闭': 'Close',
  '已连接 Pinterest': 'Pinterest connected',
  '登录时间 {time} · 推荐流可用': 'Logged in {time} · Feed available',
  '推荐流可用': 'Feed available',
  '退出登录': 'Log out',
  '退出只会删除本机保存的 cookie,不会影响你浏览器里的 Pinterest 登录。': 'Logging out only deletes the cookie saved on this machine; it doesn\'t affect your Pinterest login in the browser.',
  '连接方式': 'Connection method',
  '一键登录': 'Quick login',
  '粘贴 Cookie': 'Paste Cookie',
  'Pinterest 不提供免登录的个性化推荐接口,所以推荐流必须用你的登录态读取;登录态只用于读取你自己的首页流。': 'Pinterest doesn\'t offer a login-free personalized recommendation API, so the feed must be read with your login. The session is used only to read your own home feed.',
  '推荐加载失败': 'Failed to load recommendations',
  '推荐没加载出来': 'Recommendations didn\'t load',
  'Pinterest 这次没给推荐,可以重试或返回推荐流': 'Pinterest didn\'t return recommendations this time. Retry or go back to your feed.',
  '这条 Pin 暂时没有相似推荐': 'No similar Pins for this Pin yet',
  '点左上角返回,继续看你的推荐流': 'Click Back at the top left to keep browsing your feed',
  'Pin 详情': 'Pin details',
  '返回上一个 Pin': 'Back to the previous Pin',
  '返回浏览': 'Back to browsing',
  '上一个': 'Previous',
  '返回': 'Back',
  '已看 {count} 个 Pin · 下面还有更多类似': 'Viewed {count} Pins · More similar Pins below',
  '下面还有更多类似 Pin,可以一直点下去': 'More similar Pins below - keep clicking',
  '原帖': 'Original post',
  '收藏于「{board}」': 'Saved to "{board}"',
  '视频 Pin': 'Video Pin',
  '处理中': 'Working',
  '已收藏 · 取消': 'Saved · Unsave',
  '收藏到哪个收藏夹': 'Board to save to',
  '更多类似': 'More like this',
  '来自 Pinterest 的推荐': 'Recommended by Pinterest',
  '点任意一张继续看,或返回你的推荐流': 'Click any Pin to keep going, or go back to your feed',
})

// ---- src/client/parts/19-i18n-root.js ----
/* eslint-disable */
/** 根组件与设置弹层的英文词典(中文原文 → English) */
pcAddDict({
  // 共享层
  '刚刚': 'just now',
  '{n} 分钟前': '{n} min ago',
  '{n} 小时前': '{n} h ago',
  '{n} 天前': '{n} d ago',
  '{m}月{d}日': '{m}/{d}',
  '已收藏': 'Saved',

  '连不上收藏服务,请稍后重试': 'Cannot reach the collection service. Please try again.',
  '请求失败 ({status})': 'Request failed ({status})',

  // 根组件
  'Pinterest 面板出错了': 'Pinterest panel crashed',
  '重试': 'Retry',
  '收藏夹加载失败': 'Could not load your saves',
  '这条 Pin 已经在收藏夹里了': 'This Pin is already in that board',
  '已收藏到「{board}」': 'Saved to "{board}"',
  '我的收藏': 'My saves',
  '收藏失败': 'Could not save',
  '已从收藏夹移除': 'Removed from your saves',
  '取消收藏失败': 'Could not remove',
  '已新建「{title}」': 'Created "{title}"',
  '新建收藏夹失败': 'Could not create board',
  '收藏夹已改名': 'Board renamed',
  '改名失败': 'Could not rename board',
  '收藏夹已删除,里面的 Pin 已归入默认收藏夹': 'Board deleted; its Pins moved to the default board',
  '删除收藏夹失败': 'Could not delete board',
  '拖动调整收藏栏宽度': 'Drag to resize the saves column',

  'Pinterest 收藏': 'Pinterest Collection',
  '我的账号': 'My account',
  '在 Pinterest 打开': 'Open on Pinterest',
  '{pins} 个 Pin · {boards} 个画板': '{pins} Pins · {boards} boards',
  '你的 Pinterest 账号': 'Your Pinterest account',
  '我的 Pin': 'My Pins',
  '你在 Pinterest 上 pin 的图': 'Pins you pinned on Pinterest',
  'Pinterest 上还没有 Pin': 'No Pins on Pinterest yet',
  '你在 Pinterest 上 pin 过的图会出现在这里。': 'Images you pinned on Pinterest will show up here.',
  '重新登录后就能看到你在 Pinterest 上 pin 的图。': 'Sign in again to see the Pins from your Pinterest account.',
  'Pinterest 账号': 'Pinterest account',
  '查看账号': 'View account',
  '正在加载更多': 'Loading more',
  '已经到底了': 'You have reached the end',
  '没加载出来': 'Could not load',
  '登录时间 {time}': 'Logged in {time}',
  '搜索「{query}」· 按你的画像排序': 'Search "{query}" · ranked for you',
  '推荐按你的口味生成': 'Recommendations tuned to your taste',
  '登录后这里会显示你的 Pinterest 名称和头像。': 'Sign in to see your Pinterest name and avatar here.',
  '这里显示当前登录的 Pinterest 账号;登录态只保存在本机。': 'The Pinterest account you are signed in with; the session stays on this machine.',
  '相关 App': 'Related app',
  '跟随系统时会随 macOS/Windows 的深浅色自动切换;也可以固定浅色或深色。': 'System follows the macOS/Windows light–dark setting; you can also pin light or dark.',
  '主题属于 Harness 全局偏好,整个界面会一起切换,并会被持久化。': 'Themes are a Harness-wide preference; the whole UI switches together and the choice is persisted.',
  '版本信息与本地数据位置。': 'Version and local data locations.',
  '插件官网': 'Website',
  '开发者': 'Developer',
  '导出数据': 'Export data',
  '正在导出…': 'Exporting…',
  '已导出数据': 'Data exported',
  '导出失败': 'Export failed',
  '导出收藏夹、备注与画板为 JSON 文件(不含登录 Cookie)。': 'Export boards, saves and notes as a JSON file (no login cookie).',
  '登录 Pinterest': 'Sign in to Pinterest',
  '在 iPhone / iPad 上保存社交平台上的帖子(含 Pinterest)。': 'Save posts from social apps on iPhone / iPad, Pinterest included.',
  'iPhone / iPad 上保存社交帖子,覆盖 23 个平台(含 Pinterest)。': 'Save social posts on iPhone / iPad across 23 platforms, Pinterest included.',
  '免费 · iOS 17+': 'Free · iOS 17+',
  '版本': 'Version',
  '数据位置': 'Data',
  '说明': 'Notes',
  '收藏与登录态只保存在本机。': 'Saves and the login session stay on this machine.',

  // 设置
  '设置': 'Settings',
  '关闭': 'Close',
  '外观': 'Appearance',
  '语言': 'Language',
  '关于': 'About',
  '跟随系统': 'System',
  '浅色': 'Light',
  '深色': 'Dark',
  '切换主题失败,当前环境不支持': 'Could not switch theme in this environment',
  '切换语言失败,当前环境不支持': 'Could not switch language in this environment',
  '跟随系统时会随 macOS/Windows 的深浅色自动切换。': 'System follows the macOS/Windows light–dark setting automatically.',
  '语言属于 Harness 全局偏好,切换后面板与整个界面一起生效。': 'Language is a Harness-wide preference; the panel and the whole UI switch together.',
  'Pinterest 收藏 v1.2.0 · 左栏收藏、右栏浏览与登录推荐。': 'Pinterest Collection v1.2.0 · saves on the left, browsing and logged-in recommendations on the right.',
  '收藏数据与登录态只保存在本机 ~/.dsh/pinterest-collect/。': 'Saves and the login session live only on this machine, in ~/.dsh/pinterest-collect/.',
  '这些偏好由 Harness 保存,下次启动仍然生效;随时可以在这里改回来。': 'Harness persists these preferences across launches; you can change them back here anytime.'
})

// ---- src/client/parts/20-browser.js ----
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
  const { savedMap, savedRecordMap, savingPinId, onSave, onUnsave, onUpdateNote, onToast, boards, defaultBoardId, openRequest, onOpenSettings, onOpenAccount, page, onClosePage } = props

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
            savedRecordMap,
            savingPinId,
            defaultBoardId,
            onSave,
            onUnsave,
            onUpdateNote,
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

// ---- src/client/parts/22-promo.js ----
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

// ---- src/client/parts/23-account.js ----
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

// ---- src/client/parts/24-settings.js ----
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
  const [exporting, setExporting] = useState(false)
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

  async function exportData() {
    if (exporting) return
    setExporting(true)
    try {
      const response = await fetch('/pinterest-api/export', { headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error(pcT('导出失败'))
      const text = await response.text()
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10)
      const link = document.createElement('a')
      link.href = url
      link.download = `pinterest-collect-${date}.json`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      if (onToast) onToast(pcT('已导出数据'))
    } catch (error) {
      if (onToast) onToast((error && error.message) || pcT('导出失败'), 'error')
    } finally {
      setExporting(false)
    }
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
        { className: 'pc-settings-export' },
        h(
          'button',
          {
            type: 'button',
            className: 'pc-btn pc-settings-export-btn',
            disabled: exporting,
            onClick: exportData
          },
          pcIcon(exporting ? 'spinner' : 'download', 14),
          h('span', null, exporting ? pcT('正在导出…') : pcT('导出数据'))
        ),
        h('p', { className: 'pc-settings-hint' }, pcT('导出收藏夹、备注与画板为 JSON 文件(不含登录 Cookie)。'))
      ),
      h(
        'div',
        { className: 'pc-settings-links' },
        h(
          'a',
          {
            className: 'pc-settings-link',
            href: 'https://pinterestcollect.pages.dev/',
            target: '_blank',
            rel: 'noopener noreferrer'
          },
          pcIcon('globe', 14),
          h('span', { className: 'pc-settings-link-label' }, pcT('插件官网')),
          h('span', { className: 'pc-settings-link-url' }, 'pinterestcollect.pages.dev'),
          pcIcon('external', 12)
        ),
        h(
          'a',
          {
            className: 'pc-settings-link',
            href: 'https://x.com/iextrastu',
            target: '_blank',
            rel: 'noopener noreferrer'
          },
          pcIcon('link', 14),
          h('span', { className: 'pc-settings-link-label' }, pcT('开发者')),
          h('span', { className: 'pc-settings-link-url' }, 'x.com/iextrastu'),
          pcIcon('external', 12)
        )
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

// ---- src/client/parts/25-login.js ----
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

// ---- src/client/parts/30-detail.js ----
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

/** 全屏图片预览:点击详情页大图打开,Esc / 点背景 / 关闭按钮退出。 */
function PcImageLightbox(props) {
  const { src, title, onClose } = props
  const closeRef = useRef(null)
  const restoreRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    restoreRef.current = typeof document !== 'undefined' ? document.activeElement : null
    if (closeRef.current && closeRef.current.focus) closeRef.current.focus()
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (onCloseRef.current) onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      const restore = restoreRef.current
      if (restore && typeof restore.focus === 'function') restore.focus()
    }
  }, [])

  return h(
    'div',
    {
      className: 'pc-lightbox',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': title || pcT('图片预览'),
      onMouseDown: function (event) {
        if (event.target === event.currentTarget && onCloseRef.current) onCloseRef.current()
      }
    },
    h(
      'div',
      { className: 'pc-lightbox-inner' },
      h('img', {
        className: 'pc-lightbox-image',
        src,
        alt: title || '',
        referrerPolicy: 'no-referrer',
        draggable: false
      })
    ),
    title ? h('div', { className: 'pc-lightbox-caption' }, title) : null,
    h(
      'button',
      {
        ref: closeRef,
        type: 'button',
        className: 'pc-lightbox-close',
        'aria-label': pcT('关闭预览'),
        title: pcT('关闭预览'),
        onClick: function () {
          if (onCloseRef.current) onCloseRef.current()
        }
      },
      pcIcon('close', 18)
    )
  )
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
  const [preview, setPreview] = useState(false)
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
    setPreview(false)
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
          {
            className: 'pc-closeup-media' + (image && !imgFailed ? ' pc-closeup-media-zoomable' : ''),
            role: image && !imgFailed ? 'button' : undefined,
            tabIndex: image && !imgFailed ? 0 : undefined,
            'aria-label': image && !imgFailed ? pcT('查看大图') : undefined,
            title: image && !imgFailed ? pcT('查看大图') : undefined,
            onClick: function () {
              if (image && !imgFailed) setPreview(true)
            },
            onKeyDown: function (event) {
              if (!image || imgFailed) return
              if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault()
                setPreview(true)
              }
            }
          },
          image && !imgFailed
            ? h('img', {
                src: image,
                alt: pin.title || pin.description || 'Pinterest pin',
                referrerPolicy: 'no-referrer',
                draggable: false,
                onError: () => setImgFailed(true)
              })
            : h('div', { className: 'pc-pin-fallback' }, pcIcon('pin', 30)),
          image && !imgFailed
            ? h('span', { className: 'pc-closeup-zoom', 'aria-hidden': true }, pcIcon('search', 13), h('span', null, pcT('查看大图')))
            : null
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
      preview && image && !imgFailed
        ? h(PcImageLightbox, {
            src: image,
            title: pin.title || pin.description || '',
            onClose: () => setPreview(false)
          })
        : null,
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

// ---- src/client/parts/90-app.js ----
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

  const savedRecordMap = useMemo(() => {
    const map = new Map()
    for (const pin of collection.pins || []) {
      if (pin && pin.id && !map.has(pin.id)) map.set(pin.id, pin)
    }
    return map
  }, [collection.pins])

  const savePin = useCallback(
    async (pin, boardId, note) => {
      if (!pin || !pin.id) return null
      const targetBoard = boardId || (activeBoardId !== 'all' ? activeBoardId : undefined)
      setSavingPinId(pin.id)
      try {
        const result = await pcFetch('/save', { pin, boardId: targetBoard, note: note || '' })
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

  const updateNote = useCallback(
    async (savedId, note) => {
      if (!savedId) return false
      try {
        const result = await pcFetch('/collection/note', { savedId, note: note == null ? '' : note })
        if (result && result.collection) setCollection(result.collection)
        showToast(pcT('备注已保存'))
        return true
      } catch (error_) {
        showToast((error_ && error_.message) || pcT('备注保存失败'), 'error')
        return false
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
          savedRecordMap,
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
          onUpdateNote: (savedId, note) => updateNote(savedId, note),
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

    return {
      inject: ['slots'],
      apply(ctx) {
        pcStart(ctx)
      },
    };
  },
});
