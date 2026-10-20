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
import * as visit from './routes/visit.ts'
import * as chat from './routes/chat.ts'
import * as auth from './routes/auth.ts'
import { dshHealthCheck } from './services/dsh.ts'
import { fallbackConfigured } from './services/llm.ts'
import { circuitSnapshot } from './services/circuit.ts'
import { take } from './services/guard.ts'

const { ctx, dispatch } = createHost()

// 健康检查：默认轻量（不触发模型调用）；?deep=1 仅限本机，做 dsh/供应商/熔断体检
ctx.routes.register('/api/health', 'GET', async (req, res, url) => {
  if (url.searchParams.get('deep') === '1') {
    const ip = req.socket.remoteAddress ?? ''
    const local = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
    if (!local) {
      res.writeHead(403, { 'content-type': 'application/json' })
      res.end('{"error":"local_only"}')
      return true
    }
    const lim = take('health:deep', 2, 60_000)
    if (!lim.ok) {
      res.writeHead(429, { 'content-type': 'application/json', 'retry-after': String(lim.retryAfter) })
      res.end('{"error":"rate_limited"}')
      return true
    }
    const dsh = await Promise.race([
      dshHealthCheck(),
      new Promise<{ ok: boolean; error?: string }>((resolve) => setTimeout(() => resolve({ ok: false, error: 'timeout' }), 25_000)),
    ])
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      ok: dsh.ok,
      dsh,
      primary: { configured: !!config.llm.apiKey, provider: config.llm.provider, model: config.llm.model },
      fallback: { configured: fallbackConfigured() },
      circuit: circuitSnapshot(),
    }))
    return true
  }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ ok: true }))
  return true
})

// 前端运行期开关（不含任何密钥）
ctx.routes.register('/api/config', 'GET', async (_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ voiceEnabled: config.voiceEnabled }))
  return true
})

loadPlugins(ctx, [auth, review, hint, battle, score, profile, weekly, sprite, visit, chat] as Plugin[])

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
