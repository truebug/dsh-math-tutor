// 轻量限流：单进程内存滑动窗口。线上是单实例 systemd 服务，够用；
// 多实例时需要换 Redis/共享存储（P1）。
import type { IncomingMessage } from 'node:http'

const WINDOW_SLIDE_LIMIT = 10_000
const buckets = new Map<string, number[]>()
let lastSweep = Date.now()

function sweep(now: number): void {
  if (now - lastSweep < 5 * 60_000) return
  lastSweep = now
  for (const [k, hits] of buckets) {
    if (hits.length === 0 || hits[hits.length - 1] < now - 60 * 60_000) buckets.delete(k)
  }
  // 极端情况下仍然超限：丢掉最早的一半，避免内存被刷爆
  if (buckets.size > WINDOW_SLIDE_LIMIT) {
    const keys = [...buckets.keys()].slice(0, buckets.size - WINDOW_SLIDE_LIMIT)
    for (const k of keys) buckets.delete(k)
  }
}

/** 只信任本机 nginx 写入的 X-Real-IP；直连时用 socket 地址 */
export function clientIp(req: IncomingMessage): string {
  const sock = req.socket.remoteAddress ?? 'unknown'
  const local = sock === '127.0.0.1' || sock === '::1' || sock === '::ffff:127.0.0.1'
  if (local) {
    const x = req.headers['x-real-ip']
    if (typeof x === 'string' && x.trim()) return x.trim()
  }
  return sock
}

export interface TakeResult { ok: boolean; retryAfter: number }

/** 滑动窗口计数：返回是否放行，以及建议的 Retry-After（秒） */
export function take(key: string, limit: number, windowMs: number): TakeResult {
  const now = Date.now()
  sweep(now)
  const hits = (buckets.get(key) ?? []).filter((t) => t > now - windowMs)
  if (hits.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000))
    buckets.set(key, hits)
    return { ok: false, retryAfter }
  }
  hits.push(now)
  buckets.set(key, hits)
  return { ok: true, retryAfter: 0 }
}

/** LLM 路由：每 IP 60 次/5 分钟；每个家庭 20 次/5 分钟 */
export function llmGuard(req: IncomingMessage, familyId?: string | null): TakeResult {
  const ip = take(`llm:ip:${clientIp(req)}`, 60, 5 * 60_000)
  if (!ip.ok) return ip
  if (familyId) {
    const fam = take(`llm:fam:${familyId}`, 20, 5 * 60_000)
    if (!fam.ok) return fam
  }
  return { ok: true, retryAfter: 0 }
}

// ===== 鉴权尝试：按 IP+昵称限次，连续失败锁定 =====
const FAIL_WINDOW = 30 * 60_000
const MAX_FAILS = 10

function failKey(req: IncomingMessage, nickname: string): string {
  return `auth:${clientIp(req)}:${nickname}`
}

export function authLocked(req: IncomingMessage, nickname: string): number {
  const now = Date.now()
  const fails = (buckets.get(`fail:${failKey(req, nickname)}`) ?? []).filter((t) => t > now - FAIL_WINDOW)
  if (fails.length >= MAX_FAILS) return Math.max(1, Math.ceil((fails[0] + FAIL_WINDOW - now) / 1000))
  return 0
}

export function recordAuthFailure(req: IncomingMessage, nickname: string): void {
  const key = `fail:${failKey(req, nickname)}`
  const now = Date.now()
  const fails = (buckets.get(key) ?? []).filter((t) => t > now - FAIL_WINDOW)
  fails.push(now)
  buckets.set(key, fails)
  take(`auth:ip:${clientIp(req)}`, 1, 10 * 60_000)  // 顺带记录 IP 频率
}

export function clearAuthFailures(req: IncomingMessage, nickname: string): void {
  buckets.delete(`fail:${failKey(req, nickname)}`)
}

/** 登录/注册入口：每 IP 10 次/10 分钟，每昵称 5 次/10 分钟 */
export function authGuard(req: IncomingMessage, nickname: string): TakeResult {
  const locked = authLocked(req, nickname)
  if (locked > 0) return { ok: false, retryAfter: locked }
  const ip = take(`auth:ip:${clientIp(req)}`, 10, 10 * 60_000)
  if (!ip.ok) return ip
  return take(`auth:nick:${nickname}`, 5, 10 * 60_000)
}
