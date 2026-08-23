// 寻宝探险：关卡、星星、宠物养成、每日挑战 —— 本地持久化
import type { Level, Op } from '@dsh-math-tutor/math-generator/core'

export interface StageDef {
  id: string
  name: string
  emoji: string
  desc: string
  count: number
  durationSec: number
  level: Level
  ops: Op[]
}

// 寻宝地图：从森林出发，一路到宝藏岛
export const STAGES: StageDef[] = [
  { id: 'forest',  name: '萤火森林', emoji: '🌲', desc: '20题 · 3分钟 · 基础', count: 20, durationSec: 180, level: 1, ops: ['add', 'sub'] },
  { id: 'cave',    name: '回声山洞', emoji: '🕳️', desc: '30题 · 3分钟 · 基础', count: 30, durationSec: 180, level: 1, ops: ['add', 'sub'] },
  { id: 'lake',    name: '水晶湖底', emoji: '💧', desc: '40题 · 4分钟 · 进阶', count: 40, durationSec: 240, level: 2, ops: ['add', 'sub'] },
  { id: 'snow',    name: '雪山之巅', emoji: '🏔️', desc: '50题 · 4分钟 · 进阶', count: 50, durationSec: 240, level: 2, ops: ['add', 'sub'] },
  { id: 'island',  name: '宝藏岛',   emoji: '🏝️', desc: '60题 · 5分钟 · 挑战', count: 60, durationSec: 300, level: 3, ops: ['add', 'sub'] },
]

export interface AdventureState {
  stars: Record<string, number>   // stageId -> 0..3（取历史最高）
  daily: Record<string, number>   // 'YYYY-MM-DD' -> stars
}

const KEY = 'dsh-math-tutor:adventure'

export function loadAdventure(): AdventureState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fallthrough */ }
  return { stars: {}, daily: {} }
}

export function totalStars(a: AdventureState = loadAdventure()): number {
  return Object.values(a.stars).reduce((n, s) => n + s, 0) + Object.values(a.daily).reduce((n, s) => n + s, 0)
}

export function recordStars(id: string, stars: number, daily = false): AdventureState {
  const a = loadAdventure()
  const map = daily ? a.daily : a.stars
  map[id] = Math.max(map[id] ?? 0, stars)
  localStorage.setItem(KEY, JSON.stringify(a))
  return a
}

// 关卡解锁：第一关默认解锁，其余需要前一关至少 1 星
export function isUnlocked(index: number, a: AdventureState): boolean {
  if (index === 0) return true
  return (a.stars[STAGES[index - 1].id] ?? 0) >= 1
}

// 成绩 → 星星
export function starsFor(correct: number, total: number): number {
  const acc = total > 0 ? correct / total : 0
  if (acc === 1) return 3
  if (acc >= 0.9) return 2
  if (acc >= 0.8) return 1
  return 0
}

// 宠物养成：星星孵化成长
export const PET_STAGES = [
  { min: 0, emoji: '🥚', name: '神秘蛋' },
  { min: 5, emoji: '🐣', name: '破壳小鸡' },
  { min: 15, emoji: '🦊', name: '寻宝小狐' },
  { min: 30, emoji: '🐯', name: '探险小虎' },
  { min: 60, emoji: '🐉', name: '守护神龙' },
]

export function petStage(stars: number) {
  let cur = PET_STAGES[0]
  for (const p of PET_STAGES) if (stars >= p.min) cur = p
  const next = PET_STAGES[PET_STAGES.indexOf(cur) + 1]
  return { ...cur, next }
}

// 称号
export const TITLES = [
  { min: 0, name: '口算新手' },
  { min: 10, name: '青铜小探员' },
  { min: 25, name: '白银探险家' },
  { min: 50, name: '黄金猎人' },
  { min: 100, name: '宝藏大师' },
]

export function titleFor(stars: number): string {
  let cur = TITLES[0].name
  for (const t of TITLES) if (stars >= t.min) cur = t.name
  return cur
}

// 每日挑战：种子 = 日期，全班同一天同一份题
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function dailySeed(): number {
  return Number(todayKey().replace(/-/g, ''))
}

export function dailySettings() {
  return { count: 30, durationSec: 180, level: 2 as Level, ops: ['add', 'sub'] as Op[], seed: dailySeed() }
}
