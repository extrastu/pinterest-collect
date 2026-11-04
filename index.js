/**
 * Monorepo 安装入口:插件实现在 packages/plugin,这里转发导出。
 * 用动态 import 而不是静态 re-export,避免 ESM loader 在循环检测上把两个模块图叠在一起。
 */
const plugin = await import('./packages/plugin/index.js')

export const name = plugin.name
export const inject = plugin.inject
export const apply = plugin.apply
