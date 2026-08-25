// 多人对战房间：内存态 relay（重启即清空，孩子场景可接受）。
// 设计约束（见 docs/architecture.md）：MVP 不引入 WebSocket，前端 1s 轮询。

export interface BattlePlayer {
  nickname: string
  correct: number
  answered: number
  usedMs: number | null   // 非 null 表示已完成
  joinedAt: number
}

interface Room {
  code: string            // 竞赛码 = 房间号（同码同题）
  players: BattlePlayer[]
  createdAt: number
}

const rooms = new Map<string, Room>()
const TTL = 2 * 60 * 60 * 1000  // 2 小时过期

function sweep() {
  const now = Date.now()
  for (const [k, r] of rooms) if (now - r.createdAt > TTL) rooms.delete(k)
}

export function joinRoom(code: string, nickname: string): Room {
  sweep()
  let room = rooms.get(code)
  if (!room) {
    room = { code, players: [], createdAt: Date.now() }
    rooms.set(code, room)
  }
  if (!room.players.some((p) => p.nickname === nickname) && room.players.length < 8) {
    room.players.push({ nickname, correct: 0, answered: 0, usedMs: null, joinedAt: Date.now() })
  }
  return room
}

export function reportScore(code: string, nickname: string, correct: number, answered: number, usedMs: number): Room | null {
  const room = rooms.get(code)
  const player = room?.players.find((p) => p.nickname === nickname)
  if (!room || !player) return null
  Object.assign(player, { correct, answered, usedMs })
  return room
}

export function getRoom(code: string): Room | null {
  sweep()
  return rooms.get(code) ?? null
}

// ===== DSH 插件壳 =====
import type { ServerContext } from '../host.ts'
export const name = 'battle'
export function apply(ctx: ServerContext) {
  ctx.routes.register('/api/battle/*', 'POST', async (_req, res, url, body) => {
    const parts = url.pathname.split('/')
    const action = parts[3]
    const code = decodeURIComponent(parts[4] ?? '')
    const json = (status: number, b: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)) }
    if (action === 'join') {
      const { nickname } = body as { nickname?: string }
      if (!nickname) { json(400, { error: 'nickname_required' }); return true }
      json(200, joinRoom(code, nickname.slice(0, 12)))
      return true
    }
    if (action === 'score') {
      const b = body as { nickname?: string; correct?: number; answered?: number; usedMs?: number }
      if (!b.nickname || b.correct === undefined || b.answered === undefined || b.usedMs === undefined) {
        json(400, { error: 'bad_request' }); return true
      }
      const room = reportScore(code, b.nickname, b.correct, b.answered, b.usedMs)
      room ? json(200, room) : json(404, { error: 'not_in_room' })
      return true
    }
    return false
  })
  ctx.routes.register('/api/battle/*', 'GET', async (_req, res, url) => {
    const parts = url.pathname.split('/')
    if (parts[3] !== 'state') return false
    const room = getRoom(decodeURIComponent(parts[4] ?? ''))
    const json = (status: number, b: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)) }
    room ? json(200, room) : json(404, { error: 'no_room' })
    return true
  })
}
