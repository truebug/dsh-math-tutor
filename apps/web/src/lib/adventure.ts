// 寻宝探险：关卡、星星、宠物养成、每日挑战 —— 本地持久化
import type { Level, Op } from '@dsh-math-tutor/math-generator/core'
import { pushProfile } from './sync'

export interface StageDef {
  id: string
  name: string
  emoji: string
  desc: string
  count: number
  durationSec: number
  level: Level
  ops: Op[]
  max: number   // 结果上限：加减法 100/1000，乘除法 81
  domain?: 'int' | 'dec'  // dec = 小数加减
}

// 寻宝地图：科目大陆制（初始分路，独立解锁链；中间不分支——科目间无前置依赖）
export const STAGES: StageDef[] = [
  { id: 'forest',  name: '萤火森林', emoji: '🌲', desc: '20题 · 3分钟 · 基础', count: 20, durationSec: 180, level: 1, ops: ['add', 'sub'], max: 100 },
  { id: 'cave',    name: '回声山洞', emoji: '🕳️', desc: '30题 · 3分钟 · 基础', count: 30, durationSec: 180, level: 1, ops: ['add', 'sub'], max: 100 },
  { id: 'lake',    name: '水晶湖底', emoji: '💧', desc: '40题 · 4分钟 · 进阶', count: 40, durationSec: 240, level: 2, ops: ['add', 'sub'], max: 100 },
  { id: 'snow',    name: '雪山之巅', emoji: '🏔️', desc: '50题 · 4分钟 · 进阶', count: 50, durationSec: 240, level: 2, ops: ['add', 'sub'], max: 100 },
  { id: 'island',  name: '宝藏岛',   emoji: '🏝️', desc: '60题 · 5分钟 · 挑战', count: 60, durationSec: 300, level: 3, ops: ['add', 'sub'], max: 100 },
  { id: 'vine',    name: '藤蔓山谷', emoji: '🌿', desc: '20题 · 3分钟 · 乘法入门', count: 20, durationSec: 180, level: 1, ops: ['mul'], max: 81 },
  { id: 'bamboo',  name: '蜂蜜竹林', emoji: '🎋', desc: '30题 · 3分钟 · 九九乘法', count: 30, durationSec: 180, level: 2, ops: ['mul'], max: 81 },
  { id: 'falls',   name: '瀑布峡谷', emoji: '🌊', desc: '30题 · 3分钟 · 表内除法', count: 30, durationSec: 180, level: 2, ops: ['div'], max: 81 },
  { id: 'thunder', name: '雷鸣峰',   emoji: '⛰️', desc: '40题 · 4分钟 · 乘除混合', count: 40, durationSec: 240, level: 2, ops: ['mul', 'div'], max: 81 },
  { id: 'temple',  name: '黄金圣殿', emoji: '🏆', desc: '50题 · 5分钟 · 乘除挑战', count: 50, durationSec: 300, level: 3, ops: ['mul', 'div'], max: 81 },
  { id: 'meadow',  name: '云端草原', emoji: '🌤️', desc: '30题 · 4分钟 · 千以内加减', count: 30, durationSec: 240, level: 1, ops: ['add', 'sub'], max: 1000 },
  { id: 'desert',  name: '沙漠绿洲', emoji: '🏜️', desc: '40题 · 4分钟 · 千以内进阶', count: 40, durationSec: 240, level: 2, ops: ['add', 'sub'], max: 1000 },
  { id: 'volcano', name: '烈焰火山', emoji: '🌋', desc: '50题 · 5分钟 · 千以内挑战', count: 50, durationSec: 300, level: 3, ops: ['add', 'sub'], max: 1000 },
  { id: 'rainbow', name: '彩虹泉',   emoji: '🌈', desc: '20题 · 4分钟 · 一位小数', count: 20, durationSec: 240, level: 1, ops: ['add', 'sub'], max: 100, domain: 'dec' },
  { id: 'galaxy',  name: '星空驿站', emoji: '🌌', desc: '30题 · 4分钟 · 小数进阶', count: 30, durationSec: 240, level: 2, ops: ['add', 'sub'], max: 100, domain: 'dec' },
  { id: 'moon',    name: '月面城',   emoji: '🌙', desc: '40题 · 5分钟 · 两位小数挑战', count: 40, durationSec: 300, level: 3, ops: ['add', 'sub'], max: 100, domain: 'dec' },
]

export interface AdventureState {
  stars: Record<string, number>   // stageId -> 0..3（取历史最高）
  daily: Record<string, number>   // 'YYYY-MM-DD' -> stars
  lastUnlock?: string             // 最近一次解锁的关卡（用于解锁仪式，消费后清除）
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
  // 解锁仪式：本次得星若解锁了下一关，记录 lastUnlock
  if (!daily && stars >= 1) {
    const idx = STAGES.findIndex((s) => s.id === id)
    const next = STAGES[idx + 1]
    if (idx >= 0 && next && (a.stars[next.id] ?? 0) === 0) {
      a.lastUnlock = next.id
    }
  }
  localStorage.setItem(KEY, JSON.stringify(a))
  return a
}

export function consumeUnlock(): string | null {
  const a = loadAdventure()
  const id = a.lastUnlock ?? null
  if (id) {
    delete a.lastUnlock
    localStorage.setItem(KEY, JSON.stringify(a))
  }
  return id
}

// 关卡解锁：第一关默认解锁，其余需要前一关至少 1 星
export function isUnlocked(index: number, a: AdventureState): boolean {
  if (index === 0) return true
  return (a.stars[STAGES[index - 1].id] ?? 0) >= 1
}

// ===== 科目大陆 =====
export interface SubjectDef {
  id: 'math' | 'chinese' | 'english'
  name: string
  emoji: string
  desc: string
  comingSoon: boolean
}

export const SUBJECTS: SubjectDef[] = [
  { id: 'math', name: '数学大陆', emoji: '🔢', desc: '16 关 · 沪教版 2~4 年级计算', comingSoon: false },
  { id: 'chinese', name: '语文大陆', emoji: '📖', desc: '字词/阅读/古诗 · 即将开放', comingSoon: true },
  { id: 'english', name: '英语大陆', emoji: '🔤', desc: '单词/句型/听说 · 即将开放', comingSoon: true },
]

const SUBJECT_KEY = 'dsh-math-tutor:subject'

export function currentSubject(): SubjectDef['id'] {
  const v = localStorage.getItem(SUBJECT_KEY)
  return v === 'chinese' || v === 'english' ? v : 'math'
}

export function setSubject(id: SubjectDef['id']): void {
  localStorage.setItem(SUBJECT_KEY, id)
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
