// 积分系统客户端：提交成绩/排行榜/全服最高
import { getFamilyId } from './sync'

export interface ScoreResult {
  dailyBonus: number
  recordBonus: number
  serverRecordBonus: number
  fullScoreBonus: number
  totalPoints: number
  rank: number
  accuracy: number
  isPersonalBest: boolean
  isServerBest: boolean
}

export async function submitScore(req: {
  nickname: string
  mode: string
  level: number
  total: number
  correct: number
}): Promise<ScoreResult | null> {
  const familyId = getFamilyId()
  if (!familyId) return null   // 未开启同步不参与积分
  try {
    const res = await fetch('/api/score/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ familyId, ...req }),
    })
    if (!res.ok) return null
    return (await res.json()) as ScoreResult
  } catch {
    return null
  }
}

export interface LeaderboardEntry {
  rank: number
  nicknameMasked: string
  totalPoints: number
}

export async function getLeaderboard(): Promise<{ entries: LeaderboardEntry[]; myRank: number | null } | null> {
  const familyId = getFamilyId()
  try {
    const res = await fetch(`/api/score/leaderboard?familyId=${encodeURIComponent(familyId ?? '')}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function getServerBest(mode: string, level: number): Promise<number> {
  try {
    const res = await fetch(`/api/score/best?mode=${encodeURIComponent(mode)}&level=${level}`)
    if (!res.ok) return 0
    const data = await res.json()
    return data.serverBest ?? 0
  } catch {
    return 0
  }
}
