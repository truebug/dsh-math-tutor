// DSH 插件宿主：HTTP 服务仅作分发器，业务能力全部以插件形式加载
// P0 纯重构：对外 API 行为与重构前完全一致
import { createServer } from 'node:http'
import { config } from './config.ts'
import { createHost, loadPlugins, type Plugin } from './host.ts'
import * as review from './routes/review.ts'
import * as hint from './routes/hint.ts'
import * as battle from './routes/battle.ts'
import * as score from './routes/score.ts'
import * as profile from './routes/profile.ts'
import * as weekly from './routes/weekly.ts'
import * as sprite from './routes/sprite.ts'

const { ctx, dispatch } = createHost()

// 健康检查（基础设施，非业务插件）
ctx.routes.register('/api/health', 'GET', async (_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ ok: true }))
  return true
})

loadPlugins(ctx, [review, hint, battle, score, profile, weekly, sprite] as Plugin[])

const server = createServer(async (req, res) => {
  try {
    await dispatch(req, res)
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'internal_error' }))
  }
})

server.listen(config.port, config.host, () => {
  console.log(`[server] listening on http://${config.host}:${config.port} (llm=${config.llm.provider}/${config.llm.model})`)
})
