// 最小化 Cordis 约定宿主：与 @deepseek-ai/cordis 插件签名兼容（name/inject/apply）
// P0 阶段不引入完整 dsh 运行时，仅统一插件形态；P1 可原样挂入 dsh Runtime
import type { IncomingMessage, ServerResponse } from 'node:http'

export interface RouteHandler {
  (req: IncomingMessage, res: ServerResponse, url: URL, body: unknown): Promise<boolean> | boolean
}

export interface ServerContext {
  routes: { register(pattern: string, method: string, handler: RouteHandler): void }
  logger: { info(msg: string): void; warn(msg: string): void }
}

export interface Plugin {
  name: string
  inject?: string[]
  apply(ctx: ServerContext): void
}

interface RouteEntry { pattern: RegExp; method: string; handler: RouteHandler }

export function createHost(): { ctx: ServerContext; dispatch: (req: IncomingMessage, res: ServerResponse) => Promise<void> } {
  const routes: RouteEntry[] = []
  const ctx: ServerContext = {
    routes: {
      register(pattern, method, handler) {
        // "POST /api/score/submit" 或 "GET /api/score/best*" 形式
        const re = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$')
        routes.push({ pattern: re, method, handler })
      },
    },
    logger: console,
  }
  const dispatch = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://x')
    for (const r of routes) {
      if (r.method !== req.method || !r.pattern.test(url.pathname)) continue
      let body: unknown
      if (req.method === 'POST' || req.method === 'PUT') {
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const raw = Buffer.concat(chunks).toString('utf8')
        body = raw ? JSON.parse(raw) : {}
      }
      const handled = await r.handler(req, res, url, body)
      if (handled !== false) return
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'not_found' }))
  }
  return { ctx, dispatch }
}

export function loadPlugins(ctx: ServerContext, plugins: Plugin[]): void {
  for (const p of plugins) {
    p.apply(ctx)
    ctx.logger.info(`[plugin] ${p.name} loaded`)
  }
}
