// 匿名访客画像：区分试玩访客 vs 建档孩子，统计每日新增/回访
// 隐私红线：只记随机 UUID + 日期粒度 + 是否建档，不记 IP/UA/身份
import { mkdirSync, appendFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ServerContext } from '../host.ts'

const FILE = join(process.cwd(), 'data', 'visits.jsonl')

interface VisitRow { v: string; d: string; reg: boolean }  // visitorId / 日期 / 已建档

function today(): string { return new Date().toISOString().slice(0, 10) }

export const name = 'visit'
export function apply(ctx: ServerContext) {
  ctx.routes.register('/api/visit', 'POST', (_req, res, _url, body) => {
    const b = body as { visitorId?: string; registered?: boolean }
    if (!b?.visitorId || typeof b.visitorId !== 'string' || b.visitorId.length > 64) {
      res.writeHead(400, { 'content-type': 'application/json' }); res.end('{"error":"bad_request"}'); return true
    }
    try {
      mkdirSync(join(process.cwd(), 'data'), { recursive: true })
      appendFileSync(FILE, JSON.stringify({ v: b.visitorId, d: today(), reg: !!b.registered }) + '\n')
    } catch { /* 记录失败不影响访问 */ }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}')
    return true
  })

  // 聚合统计：近 14 天每日访客数（去重）+ 其中建档数 + 累计独立访客
  ctx.routes.register('/api/visit/stats', 'GET', (_req, res) => {
    const days: Record<string, { visitors: Set<string>; registered: Set<string> }> = {}
    const all = new Set<string>()
    if (existsSync(FILE)) {
      try {
        for (const line of readFileSync(FILE, 'utf8').split('\n')) {
          if (!line.trim()) continue
          const r = JSON.parse(line) as VisitRow
          all.add(r.v)
          ;(days[r.d] ??= { visitors: new Set(), registered: new Set() }).visitors.add(r.v)
          if (r.reg) days[r.d].registered.add(r.v)
        }
      } catch { /* 损坏行跳过 */ }
    }
    const daily = Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).slice(-14)
      .map(([d, s]) => ({ date: d, visitors: s.visitors.size, registered: s.registered.size }))
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ total: all.size, daily }))
    return true
  })
}
