// 每日加分 + 破纪录奖励 + 排行榜：匿名积分系统
// 存储：data/scores.json（MVP 用 JSON，后续可换 SQLite）
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FILE = join(process.cwd(), 'data', 'scores.json')

export interface ScoreEntry {
  familyId: string
  nicknameMasked: string     // "小*明"
  totalPoints: number
  lastDailyDate: string      // 上次领取每日加分的日期（防重复）
  dailyStreak: number        // 连续打卡天数
  bestAccuracy: Record<string, number>   // "G2A-2" -> 个人最高正确率（%）
  serverBest: Record<string, number>     // "G2A-2" -> 全服最高正确率（%）
  updatedAt: string
}

interface ScoreStore {
  entries: ScoreEntry[]
  serverBest: Record<string, number>
}

function load(): ScoreStore {
  if (!existsSync(FILE)) return { entries: [], serverBest: {} }
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    return { entries: [], serverBest: {} }
  }
}

function save(store: ScoreStore): void {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  writeFileSync(FILE, JSON.stringify(store, null, 2))
}

function mask(nickname: string): string {
  if (!nickname) return '匿名'
  if (nickname.length === 1) return nickname
  if (nickname.length === 2) return nickname[0] + '*'
  return nickname[0] + '*'.repeat(nickname.length - 2) + nickname[nickname.length - 1]
}

function modeKey(mode: string, level: number): string {
  return `${mode}-${level}`
}

export interface SubmitScoreRequest {
  familyId: string
  nickname: string
  mode: string
  level: number
  total: number
  correct: number
  date?: string   // YYYY-MM-DD，缺省今天
}

export interface SubmitScoreResponse {
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

export function submitScore(req: SubmitScoreRequest): SubmitScoreResponse {
  const store = load()
  const today = req.date ?? new Date().toISOString().slice(0, 10)
  const acc = req.total > 0 ? Math.round((req.correct / req.total) * 100) : 0
  const key = modeKey(req.mode, req.level)

  let entry = store.entries.find((e) => e.familyId === req.familyId)
  if (!entry) {
    entry = {
      familyId: req.familyId,
      nicknameMasked: mask(req.nickname),
      totalPoints: 0,
      lastDailyDate: '',
      dailyStreak: 0,
      bestAccuracy: {},
      serverBest: {},
      updatedAt: new Date().toISOString(),
    }
    store.entries.push(entry)
  }

  // 每日加分：首次完成 ≥20 题
  let dailyBonus = 0
  if (req.total >= 20 && entry.lastDailyDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    entry.dailyStreak = entry.lastDailyDate === yesterday ? entry.dailyStreak + 1 : 1
    dailyBonus = 10 + Math.min(entry.dailyStreak - 1, 5) * 2  // 连击加成：+10/+12/+14... 最多+20
    entry.lastDailyDate = today
  }

  // 破个人记录
  const personalBest = entry.bestAccuracy[key] ?? 0
  const isPersonalBest = acc > personalBest && req.total >= 10
  const recordBonus = isPersonalBest ? 20 : 0
  if (isPersonalBest) entry.bestAccuracy[key] = acc

  // 破服务器记录
  const serverBest = store.serverBest[key] ?? 0
  const isServerBest = acc > serverBest && req.total >= 10
  const serverRecordBonus = isServerBest ? 50 : 0
  if (isServerBest) {
    store.serverBest[key] = acc
    entry.serverBest[key] = acc
  }

  // 满分奖励
  const fullScoreBonus = acc === 100 && req.total >= 10 ? 5 : 0

  entry.totalPoints += dailyBonus + recordBonus + serverRecordBonus + fullScoreBonus
  entry.updatedAt = new Date().toISOString()
  save(store)

  // 排名（按总分降序）
  const sorted = [...store.entries].sort((a, b) => b.totalPoints - a.totalPoints)
  const rank = sorted.findIndex((e) => e.familyId === req.familyId) + 1

  return {
    dailyBonus,
    recordBonus,
    serverRecordBonus,
    fullScoreBonus,
    totalPoints: entry.totalPoints,
    rank,
    accuracy: acc,
    isPersonalBest,
    isServerBest,
  }
}

export interface LeaderboardEntry {
  rank: number
  nicknameMasked: string
  totalPoints: number
}

export function getLeaderboard(familyId: string): { entries: LeaderboardEntry[]; myRank: number | null } {
  const store = load()
  const sorted = [...store.entries].sort((a, b) => b.totalPoints - a.totalPoints)
  const entries = sorted.slice(0, 20).map((e, i) => ({
    rank: i + 1,
    nicknameMasked: e.nicknameMasked,
    totalPoints: e.totalPoints,
  }))
  const myIdx = sorted.findIndex((e) => e.familyId === familyId)
  return { entries, myRank: myIdx >= 0 ? myIdx + 1 : null }
}

export function getServerBest(mode: string, level: number): number {
  const store = load()
  return store.serverBest[modeKey(mode, level)] ?? 0
}
