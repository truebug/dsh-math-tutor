// 最小化 Cordis 约定宿主：与 @deepseek-ai/cordis 插件签名兼容（name/inject/apply）
// P0 阶段不引入完整 dsh 运行时，仅统一插件形态；P1 可原样挂入 dsh Runtime
import type { IncomingMessage, ServerResponse } from 'node:http'

export interface RouteHandler {
  (req: IncomingMessage, res: ServerResponse, url: URL, body: unknown): Promise<boolean> | boolean
}

export interface ServerContext {
  routes: { register(pattern: string, method: string, handler: RouteHandler): void }
  services: Record<string, unknown>   // 插件间共享服务（P1 画像服务等经此注入）
  logger: { info(msg: string): void; warn(msg: string): void }
}

export interface Plugin {
  name: string
  inject?: string[]
  apply(ctx: ServerContext): void
}

interface RouteEntry { pattern: RegExp; method: string; handler: RouteHandler }

// 业务请求都很小（最长的画像 PUT 约几十 KB）；64KB 以上的 body 一律拒绝，
// 避免单连接把内存打满（nginx 侧同样限制 client_max_body_size）。
const MAX_BODY_BYTES = 64 * 1024

export function createHost(): { ctx: ServerContext; dispatch: (req: IncomingMessage, res: ServerResponse) => Promise<void> } {
  const routes: RouteEntry[] = []
  const ctx: ServerContext = {
    routes: {
      register(pattern, method, handler) {
        // pattern 为路径（尾部 * 为通配符），如 "/api/hint" 或 "/api/profile/*"
        const re = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$')
        routes.push({ pattern: re, method, handler })
      },
    },
    services: {},
    logger: console,
  }
  const dispatch = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://x')
    for (const r of routes) {
      if (r.method !== req.method || !r.pattern.test(url.pathname)) continue
      let body: unknown
      if (req.method === 'POST' || req.method === 'PUT') {
        const declared = Number(req.headers['content-length'] ?? 0)
        if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
          res.writeHead(413, { 'content-type': 'application/json' })
          res.end('{"error":"payload_too_large"}')
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        for await (const c of req) {
          size += (c as Buffer).length
          if (size > MAX_BODY_BYTES) {
            res.writeHead(413, { 'content-type': 'application/json' })
            res.end('{"error":"payload_too_large"}')
            return
          }
          chunks.push(c as Buffer)
        }
        const raw = Buffer.concat(chunks).toString('utf8')
        try {
          body = raw ? JSON.parse(raw) : {}
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end('{"error":"invalid_json"}')
          return
        }
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
