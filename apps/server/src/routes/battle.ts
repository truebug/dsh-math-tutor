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
