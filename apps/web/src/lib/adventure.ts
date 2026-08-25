// 寻宝探险：关卡、星星、宠物养成、每日挑战 —— 本地持久化
import type { Level, Op } from '@dsh-math-tutor/math-generator/core'
import { pushProfile } from './sync'
import { loadProfileData } from './profile'
import { loadProfile } from './storage'

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
  kind?: 'letters' | 'vocab' | 'sentence' | 'antonym' | 'chinese' | 'poem' | 'chars'  // 非数字内容生成器（选择题，不走 generateQuestions）
  subject?: 'math' | 'chinese' | 'english'
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

// 英语大陆关卡（独立解锁链）：1-8 为一年级段（1A/1B），9 起为二年级段（2A/2B）
export const ENGLISH_STAGES: StageDef[] = [
  { id: 'eng-letters1', name: '字母沙滩', emoji: '🏖️', desc: '13题 · 2分钟 · 字母 A-M', count: 13, durationSec: 120, level: 1, ops: [], max: 0, kind: 'letters', subject: 'english' },
  { id: 'eng-letters2', name: '字母礁石', emoji: '🪨', desc: '13题 · 2分钟 · 字母 N-Z', count: 13, durationSec: 120, level: 1, ops: [], max: 0, kind: 'letters', subject: 'english' },
  { id: 'eng-greet',  name: '问候灯塔', emoji: '🗼', desc: '12题 · 2分钟 · 问候与课堂用语', count: 12, durationSec: 120, level: 2, ops: [], max: 0, kind: 'vocab', subject: 'english' },
  { id: 'eng-school', name: '文具小屋', emoji: '✏️', desc: '12题 · 2分钟 · 文具与课堂', count: 12, durationSec: 120, level: 2, ops: [], max: 0, kind: 'vocab', subject: 'english' },
  { id: 'eng-body',   name: '木偶剧场', emoji: '🤸', desc: '12题 · 2分钟 · 我的身体', count: 12, durationSec: 120, level: 2, ops: [], max: 0, kind: 'vocab', subject: 'english' },
  { id: 'eng-color',  name: '彩虹画室', emoji: '🎨', desc: '12题 · 2分钟 · 颜色与数字', count: 12, durationSec: 120, level: 2, ops: [], max: 0, kind: 'vocab', subject: 'english' },
  { id: 'eng-animal', name: '动物森林', emoji: '🦁', desc: '12题 · 2分钟 · 动物朋友', count: 12, durationSec: 120, level: 2, ops: [], max: 0, kind: 'vocab', subject: 'english' },
  { id: 'eng-food',   name: '美食集市', emoji: '🍔', desc: '12题 · 2分钟 · 美食与饮料', count: 12, durationSec: 120, level: 2, ops: [], max: 0, kind: 'vocab', subject: 'english' },
  { id: 'eng-family', name: '温馨小屋', emoji: '🏠', desc: '12题 · 2分钟 · 家人与人物', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'vocab', subject: 'english' },
  { id: 'eng-toy',     name: '玩具城堡', emoji: '🧸', desc: '12题 · 2分钟 · 玩具与物品', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'vocab', subject: 'english' },
  { id: 'eng-clothes', name: '换装魔镜', emoji: '👗', desc: '12题 · 2分钟 · 衣物穿戴', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'vocab', subject: 'english' },
  { id: 'eng-weather', name: '四季风车', emoji: '🌦️', desc: '12题 · 2分钟 · 天气与户外', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'vocab', subject: 'english' },
  { id: 'eng-number',  name: '数字钟楼', emoji: '🕰️', desc: '12题 · 2分钟 · 数字 11-100', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'vocab', subject: 'english' },
  { id: 'eng-action',  name: '运动乐园', emoji: '🤾', desc: '12题 · 2分钟 · 动作能力', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'vocab', subject: 'english' },
  { id: 'eng-opp',     name: '反转镜湖', emoji: '🪞', desc: '12题 · 2分钟 · 反义词配对', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'antonym', subject: 'english' },
  { id: 'eng-sentence', name: '句型学院', emoji: '🏫', desc: '12题 · 2分钟 · 句型填空', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'sentence', subject: 'english' },
]

// 语文大陆关卡（独立解锁链）：部编版二年级上册词语表
export const CHINESE_STAGES: StageDef[] = [
  { id: 'chi-nature', name: '竹林小径', emoji: '🎋', desc: '12题 · 2分钟 · 自然篇', count: 12, durationSec: 120, level: 1, ops: [], max: 0, kind: 'chinese', subject: 'chinese' },
  { id: 'chi-school', name: '书香庭院', emoji: '🏮', desc: '12题 · 2分钟 · 校园篇', count: 12, durationSec: 120, level: 1, ops: [], max: 0, kind: 'chinese', subject: 'chinese' },
  { id: 'chi-tree',   name: '梧桐书院', emoji: '🌳', desc: '12题 · 2分钟 · 树木篇', count: 12, durationSec: 120, level: 2, ops: [], max: 0, kind: 'chinese', subject: 'chinese' },
  { id: 'chi-home',   name: '江南小镇', emoji: '🏘️', desc: '12题 · 2分钟 · 家乡篇', count: 12, durationSec: 120, level: 2, ops: [], max: 0, kind: 'chinese', subject: 'chinese' },
  { id: 'chi-story',  name: '寓言古亭', emoji: '⛩️', desc: '12题 · 2分钟 · 故事篇', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'chinese', subject: 'chinese' },
  { id: 'chi-mist',   name: '迷雾码头', emoji: '🌁', desc: '12题 · 2分钟 · 雾与风', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'chinese', subject: 'chinese' },
  { id: 'chi-snow',   name: '雪人谷',   emoji: '⛄', desc: '12题 · 2分钟 · 雪孩子', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'chinese', subject: 'chinese' },
  { id: 'chi-fox',    name: '狐狸洞窟', emoji: '🦊', desc: '12题 · 2分钟 · 狐狸故事', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'chinese', subject: 'chinese' },
  { id: 'chi-boat',   name: '纸船溪',   emoji: '⛵', desc: '12题 · 2分钟 · 友谊篇', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'chinese', subject: 'chinese' },
  { id: 'chi-poem',   name: '诗韵画舫', emoji: '🖼️', desc: '12题 · 2分钟 · 古诗补全', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'poem', subject: 'chinese' },
  { id: 'chi-char1',  name: '百字碑林', emoji: '🪦', desc: '12题 · 2分钟 · 识字读音（上）', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'chars', subject: 'chinese' },
  { id: 'chi-char2',  name: '千字石窟', emoji: '🗿', desc: '12题 · 2分钟 · 识字读音（下）', count: 12, durationSec: 120, level: 3, ops: [], max: 0, kind: 'chars', subject: 'chinese' },
]

export function stagesOf(subject: 'math' | 'chinese' | 'english'): StageDef[] {
  if (subject === 'english') return ENGLISH_STAGES
  if (subject === 'chinese') return CHINESE_STAGES
  return STAGES
}

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
export function isUnlocked(index: number, a: AdventureState, stages: StageDef[] = STAGES): boolean {
  if (index === 0) return true
  return (a.stars[stages[index - 1].id] ?? 0) >= 1
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
  { id: 'chinese', name: '语文大陆', emoji: '📖', desc: '12 关 · 部编版二上词语+古诗', comingSoon: false },
  { id: 'english', name: '英语大陆', emoji: '🔤', desc: '15 关 · 牛津上海版 1-2 年级', comingSoon: false },
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
  // 科目轮换：按日期在 语文/数学/英语 间轮转，每天题目不同（种子=日期，全班同题）
  const day = Number(todayKey().replace(/-/g, ''))
  const subject = ['chinese', 'math', 'english'][day % 3]
  const seed = dailySeed()
  if (subject === 'chinese') {
    return { count: 12, durationSec: 120, level: 2 as Level, ops: [] as Op[], max: 0, kind: 'chinese' as const, subject: 'chinese' as const, seed }
  }
  if (subject === 'english') {
    return { count: 12, durationSec: 120, level: 2 as Level, ops: [] as Op[], max: 0, kind: 'vocab' as const, subject: 'english' as const, seed }
  }
  // 年级驱动难度：三年级起上限升至 1000，四年级起启用小数（与 stageSettings 一致）
  const grade = loadProfile()?.grade ?? 2
  return { count: 30, durationSec: 180, level: 2 as Level, ops: ['add', 'sub'] as Op[], max: grade >= 3 ? 1000 : 100, domain: grade >= 4 ? ('dec' as const) : undefined, subject: 'math' as const, seed }
}

// ===== 7b-2 知识点级推荐：找「已获得星星但未满星」的最简单关，其次第一个未解锁关 =====
export function recommendStage(a: AdventureState = loadAdventure()): { stage: StageDef; reason: string } | null {
  const all = [...STAGES, ...ENGLISH_STAGES, ...CHINESE_STAGES]
  // 错题归因反哺：字词错误累计较多时，优先推荐未满星的语文/英语关
  const prof = loadProfileData()
  if ((prof.patterns?.word ?? 0) >= 3) {
    const lang = all.find((st) => st.subject !== 'math' && (a.stars[st.id] ?? 0) < 3)
    if (lang) return { stage: lang, reason: `最近字词错误有点多，去「${lang.name}」巩固一下` }
  }
  for (const st of all) {
    const got = a.stars[st.id] ?? 0
    if (got > 0 && got < 3) {
      return { stage: st, reason: `「${st.name}」已获得 ${got} 星，冲击满星！` }
    }
  }
  const firstLocked = all.find((st) => (a.stars[st.id] ?? 0) === 0)
  if (firstLocked) return { stage: firstLocked, reason: `下一站：「${firstLocked.name}」等你探索` }
  return null
}
