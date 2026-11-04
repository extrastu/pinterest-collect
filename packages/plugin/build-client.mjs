#!/usr/bin/env node
/**
 * 把 src/client/parts/*.js 与 panel.css 拼成 Harness 客户端模块 client.js。
 *
 * 客户端模块的约定(见 cordis-plugin-development → ui-plugin.md):
 *   window.__ModuleLoader__.load({ id: <package name>, factory(require) { return { inject, apply } } })
 * React 从浏览器模块表 require('react') 取得,不要打包 React。
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const partsDir = path.join(root, 'src/client/parts')
const outFile = path.join(root, 'client.js')

const exists = async target => {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

const names = (await readdir(partsDir)).filter(name => name.endsWith('.js')).sort()
if (!names.includes('10-collection.js')) {
  console.warn('[build-client] 警告:缺少 src/client/parts/10-collection.js,先用占位组件构建(仅用于自测)')
  names.push('10-collection.js')
}

const parts = []
for (const name of names) {
  const file = path.join(partsDir, name)
  const source = (await exists(file))
    ? await readFile(file, 'utf8')
    : `function CollectionPane() {\n  return h('div', { className: 'pc-collection' }, h('div', { className: 'pc-empty' }, '左侧收藏面板还在生成中'))\n}`
  parts.push(`// ---- src/client/parts/${name} ----\n${source.trim()}`)
}

const css = (await readFile(path.join(root, 'src/client/panel.css'), 'utf8')).trim()

const output = `/* pinterest-collect · 客户端面板(由 build-client.mjs 生成,勿手改)
 * 左侧:我的 Pinterest 收藏;右侧:内嵌 Pinterest 浏览器 + Pin 详情。
 * 数据来源:同源 /pinterest-api(Host 端抓取 Pinterest)。
 */
window.__ModuleLoader__.load({
  id: 'pinterest-collect',
  factory(require) {
    const PC_CSS = ${JSON.stringify(css)};

${parts.join('\n\n')}

    return {
      inject: ['slots'],
      apply(ctx) {
        pcStart(ctx)
      },
    };
  },
});
`

await writeFile(outFile, output, 'utf8')
execFileSync(process.execPath, ['--check', outFile], { stdio: 'inherit' })
console.log(`[build-client] client.js ${output.length} bytes · ${names.length} parts · css ${css.length} bytes`)
