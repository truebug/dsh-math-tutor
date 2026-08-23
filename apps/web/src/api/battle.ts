import { encodeRaceCode } from '../lib/raceCode'
import type { RaceSettings } from '../lib/types'

export interface BattlePlayer {
  nickname: string
  correct: number
  answered: number
  usedMs: number | null
}

export interface BattleRoom {
  code: string
  players: BattlePlayer[]
}

async function req(path: string, init?: RequestInit): Promise<BattleRoom | null> {
  try {
    const res = await fetch(path, init)
    if (!res.ok) return null
    return (await res.json()) as BattleRoom
  } catch {
    return null   // server 未启动时静默降级为单机模式
  }
}

export const battleJoin = (s: RaceSettings, nickname: string) =>
  req(`/api/battle/join/${encodeURIComponent(encodeRaceCode(s))}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nickname }),
  })

export const battleScore = (s: RaceSettings, nickname: string, correct: number, answered: number, usedMs: number) =>
  req(`/api/battle/score/${encodeURIComponent(encodeRaceCode(s))}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nickname, correct, answered, usedMs }),
  })

export const battleState = (code: string) =>
  req(`/api/battle/state/${encodeURIComponent(code)}`)
