#!/usr/bin/env node
/**
 * 离屏验证 Host 半的 index.js(装好的插件进程内是旧代 JS,重启前无法观察最新代码):
 * 用一个最小 ctx 直接 apply(),再伪造 req/res 调路由,检查磁盘上的真实实现。
 *
 * 这不是浏览器/React 模拟,只验证 Host 路由与存储逻辑。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { apply } from '../index.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dataDir = path.join(root, 'tools', '.tmp-host-test')

let passed = 0
let failed = 0
function check(name, ok, detail) {
  if (ok) {
    passed += 1
    console.log(`  PASS  ${name}${detail ? ` · ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail ? ` · ${detail}` : ''}`)
  }
}

const routes = []
const disposers = []
const ctx = {
  logger: { info() {}, warn() {}, error() {} },
  effect(fn) {
    const dispose = fn()
    disposers.push(dispose)
    return dispose
  },
  webServer: {
    register(route) {
      routes.push(route)
      return () => {}
    }
  }
}

apply(ctx, { dataDir, timeoutMs: 15000 })

const route = routes[0]
if (!route || route.path !== '/pinterest-api') {
  console.error('apply() 没有注册 /pinterest-api 路由')
  process.exit(1)
}

function call(method, url, body) {
  const req = { method, url }
  req[Symbol.asyncIterator] = async function* () {
    if (body !== undefined) yield Buffer.from(JSON.stringify(body), 'utf8')
  }
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 0,
      headers: null,
      chunks: [],
      writeHead(status, headers) {
        this.statusCode = status
        this.headers = headers
      },
      end(chunk) {
        if (chunk) this.chunks.push(Buffer.from(chunk))
        const text = Buffer.concat(this.chunks).toString('utf8')
        let json = null
        try {
          json = text ? JSON.parse(text) : null
        } catch {
          json = null
        }
        resolve({ status: this.statusCode, headers: this.headers, text, json })
      }
    }
    Promise.resolve(route.handler(req, res)).catch(reject)
  })
}

await fs.rm(dataDir, { recursive: true, force: true })

try {
  console.log('\n[1] 路由与结构')
  const health = await call('GET', '/pinterest-api/health')
  check('GET /health 200', health.status === 200, `status=${health.status} version=${health.json?.version}`)
  check('health.pinterest.ready 布尔字段存在', health.json && typeof health.json.pinterest === 'object' && typeof health.json.pinterest.ready === 'boolean', `ready=${health.json?.pinterest?.ready}`)
  check('health.account 账号态存在', health.json && typeof health.json.account === 'object' && typeof health.json.account.connected === 'boolean', `authReady=${health.json?.authReady} chrome=${health.json?.account?.chromeAvailable}`)
  check('health.authReady 布尔字段', typeof health.json?.authReady === 'boolean')

  const account = await call('GET', '/pinterest-api/account')
  check('GET /account 200 且未连接', account.status === 200 && account.json?.connected === false && account.json?.valid === false)
  const topics = await call('GET', '/pinterest-api/topics')
  check('推荐分类接口已移除(404)', topics.status === 404, `status=${topics.status}`)

  const feed = await call('GET', '/pinterest-api/feed')
  if (health.json?.authReady) {
    check('未登录时 /feed 返回 401', feed.status === 401, `status=${feed.status} ${feed.json?.error || ''}`)
  } else {
    check('登录模块未就绪时 /feed 返回 503(带中文提示)', feed.status === 503 && typeof feed.json?.error === 'string', `status=${feed.status} ${feed.json?.error || ''}`)
  }

  if (health.json?.account?.chromeAvailable) {
    console.log('  SKIP  登录窗口启动测试(本机会真的弹出 Chrome 窗口,离屏测试不执行)')
  } else {
    const start = await call('POST', '/pinterest-api/account/login/start', {})
    check('无 Chrome 时登录返回 409 + 降级提示', start.status === 409 && typeof start.json?.error === 'string', `status=${start.status}`)
  }

  const empty = await call('GET', '/pinterest-api/collection')
  check('GET /collection 200', empty.status === 200)
  check('空集合有默认收藏夹', Array.isArray(empty.json?.boards) && empty.json.boards.length === 1 && empty.json.boards[0].id === 'default')
  check('默认收藏夹 isDefault=true', empty.json?.boards?.[0]?.isDefault === true)

  console.log('\n[2] 收藏夹与收藏(磁盘为准的实现)')
  const created = await call('POST', '/pinterest-api/collection/boards', { title: '客厅灵感' })
  check('新建收藏夹 200', created.status === 200, created.json?.board?.title)
  check('非默认收藏夹补全 isDefault=false', created.json?.collection?.boards?.every(board => typeof board.isDefault === 'boolean'), JSON.stringify((created.json?.collection?.boards || []).map(board => [board.id, board.isDefault])))
  const boardId = created.json?.board?.id

  const pin = {
    id: 'test-pin-1',
    title: '离屏测试 Pin',
    image: 'https://i.pinimg.com/474x/00/00/00/00000000000000000000000000000000.jpg',
    width: 474,
    height: 592,
    pinUrl: 'https://www.pinterest.com/pin/test-pin-1/'
  }
  const saved = await call('POST', '/pinterest-api/save', { pin, boardId })
  check('保存到指定收藏夹 200', saved.status === 200 && saved.json?.saved?.boardId === boardId, saved.json?.saved?.savedId)
  const duplicate = await call('POST', '/pinterest-api/save', { pin, boardId })
  check('重复保存幂等', duplicate.json?.duplicate === true && duplicate.json?.collection?.pins?.length === 1)

  const renamed = await call('POST', '/pinterest-api/collection/boards/rename', { id: boardId, title: '客厅与餐厅' })
  check('重命名收藏夹', renamed.json?.board?.title === '客厅与餐厅')

  const removed = await call('POST', '/pinterest-api/collection/boards/remove', { id: boardId })
  check('删除收藏夹后 Pin 归入默认收藏夹', removed.json?.collection?.pins?.[0]?.boardId === 'default')

  const unsaved = await call('POST', '/pinterest-api/unsave', { savedId: saved.json?.saved?.savedId })
  check('取消收藏', unsaved.status === 200 && unsaved.json?.collection?.pins?.length === 0, `status=${unsaved.status} pins=${unsaved.json?.collection?.pins?.length}`)

  console.log('\n[3] 错误处理')
  const badSave = await call('POST', '/pinterest-api/save', { pin: { id: 'x' } })
  check('缺图片的 pin 返回 400 JSON', badSave.status === 400 && typeof badSave.json?.error === 'string', badSave.json?.error)
  const badJson = await call('POST', '/pinterest-api/save', undefined)
  check('空 body 仍是 400 而非崩溃', badJson.status === 400 && typeof badJson.json?.error === 'string', badJson.json?.error)
  const notFound = await call('GET', '/pinterest-api/nope')
  check('未知路由 404 JSON', notFound.status === 404 && typeof notFound.json?.error === 'string')
  const halfRoute = await call('GET', '/other/health')
  check('前缀外请求 404 JSON', halfRoute.status === 404)

  console.log('\n[4] 搜索与链接解析(真实网络)')
  const search = await call('GET', '/pinterest-api/search?q=cozy%20living%20room&limit=6')
  check('GET /search 返回真实 Pin', search.status === 200 && Array.isArray(search.json?.pins) && search.json.pins.length > 0, `pins=${search.json?.pins?.length} bookmark=${Boolean(search.json?.bookmark)}`)
  const firstPin = search.json?.pins?.[0]
  check('Pin 归一化字段齐全', Boolean(firstPin?.id && firstPin?.image && firstPin?.title && firstPin?.pinUrl && typeof firstPin?.width === 'number'), firstPin?.title?.slice(0, 28))

  const resolvePin = await call('GET', '/pinterest-api/resolve?url=' + encodeURIComponent('https://www.pinterest.com/pin/123456789/'))
  check('resolve pin 链接', resolvePin.status === 200 && resolvePin.json?.kind === 'pin', JSON.stringify(resolvePin.json))
  const resolveBoard = await call('GET', '/pinterest-api/resolve?url=' + encodeURIComponent('https://www.pinterest.com/iyundt840/living-rooms/'))
  check('resolve board 链接', resolveBoard.status === 200 && resolveBoard.json?.kind === 'board', JSON.stringify(resolveBoard.json))
  const resolveBad = await call('GET', '/pinterest-api/resolve?url=' + encodeURIComponent('https://example.com/a/b'))
  check('站外链接 resolve 为 unknown', resolveBad.json?.kind === 'unknown')
  const searchBad = await call('GET', '/pinterest-api/search?q=')
  check('空关键词返回 400', searchBad.status === 400, searchBad.json?.error)
} finally {
  for (const dispose of disposers) {
    try {
      await dispose()
    } catch {
      /* 忽略清理错误 */
    }
  }
  await fs.rm(dataDir, { recursive: true, force: true })
  // 确认临时数据目录已清掉
  const leftover = await fs.stat(dataDir).then(() => true).catch(() => false)
  if (leftover) console.log(`  警告: 临时目录未清理 ${dataDir}`)
}

console.log(`\n结果: ${passed} 通过 / ${failed} 失败 (Host 离屏验证,数据目录 ${path.relative(root, dataDir)})`)
process.exit(failed ? 1 : 0)
