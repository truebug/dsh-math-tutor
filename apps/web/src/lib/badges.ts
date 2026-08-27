// 勋章系统：确定性判定（本地数据驱动，不走 LLM），与积分互补
// 数据全部来自 localStorage 现有结构，零新增上报
import { loadAdventure, totalStars, type AdventureState } from './adventure'
import { loadSessions } from './storage'

export interface Badge {
  id: string
  name: string
  emoji: string
  desc: string
  // 判定：返回 true 表示已获得
  check: (ctx: BadgeContext) => boolean
  // 进度提示（未获得时展示「还差多少」），返回 null 表示无进度概念
  progress?: (ctx: BadgeContext) => string | null
}

export interface BadgeContext {
  adventure: AdventureState
  sessions: number        // 练习总次数
  totalCorrect: number    // 累计答对
  dailyDays: number       // 每日挑战打卡天数
  stars: number           // 总星数
  fullStars: number       // 满星（3星）关卡数
  streakDays: number      // 连续打卡天数（每日挑战）
  mistakeSessions: number // 重练过错题的次数
}

// 连续打卡天数：daily 记录从今天往前数连续的天数
function calcStreak(a: AdventureState): number {
  let streak = 0
  const d = new Date()
  for (let i = 0; i < 365; i += 1) {
    const key = d.toISOString().slice(0, 10)
    if (a.daily[key] !== undefined) streak += 1
    else if (i === 0) { /* 今天还没打卡不断昨天的链子，继续往前看 */ }
    else break
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export function buildBadgeContext(): BadgeContext {
  const adventure = loadAdventure()
  const sessions = loadSessions()
  const stageStars = Object.values(adventure.stars)
  return {
    adventure,
    sessions: sessions.length,
    totalCorrect: sessions.reduce((n, s) => n + s.correct, 0),
    dailyDays: Object.keys(adventure.daily).length,
    stars: totalStars(adventure),
    fullStars: stageStars.filter((s) => s >= 3).length,
    streakDays: calcStreak(adventure),
    mistakeSessions: sessions.filter((s) => s.settings.customQuestions !== undefined).length,
  }
}

export const BADGES: Badge[] = [
  { id: 'first',    name: '初次探险', emoji: '🌱', desc: '完成第 1 次练习',
    check: (c) => c.sessions >= 1 },
  { id: 'star10',   name: '集星新手', emoji: '⭐', desc: '累计获得 10 颗星',
    check: (c) => c.stars >= 10,  progress: (c) => `${c.stars}/10` },
  { id: 'star50',   name: '集星达人', emoji: '🌟', desc: '累计获得 50 颗星',
    check: (c) => c.stars >= 50,  progress: (c) => `${c.stars}/50` },
  { id: 'star150',  name: '藏宝大师', emoji: '💎', desc: '累计获得 150 颗星',
    check: (c) => c.stars >= 150, progress: (c) => `${c.stars}/150` },
  { id: 'perfect1', name: '首个满星', emoji: '🏅', desc: '任意关卡获得满星',
    check: (c) => c.fullStars >= 1 },
  { id: 'perfect5', name: '满星猎手', emoji: '🏆', desc: '5 个关卡满星',
    check: (c) => c.fullStars >= 5, progress: (c) => `${c.fullStars}/5` },
  { id: 'daily3',   name: '三日坚持', emoji: '📅', desc: '连续 3 天打卡每日挑战',
    check: (c) => c.streakDays >= 3, progress: (c) => `${c.streakDays}/3 天` },
  { id: 'daily7',   name: '七日勇士', emoji: '🔥', desc: '连续 7 天打卡每日挑战',
    check: (c) => c.streakDays >= 7, progress: (c) => `${c.streakDays}/7 天` },
  { id: 'daily30',  name: '月度传奇', emoji: '👑', desc: '连续 30 天打卡每日挑战',
    check: (c) => c.streakDays >= 30, progress: (c) => `${c.streakDays}/30 天` },
  { id: 'right100', name: '百题斩',   emoji: '💯', desc: '累计答对 100 题',
    check: (c) => c.totalCorrect >= 100,  progress: (c) => `${c.totalCorrect}/100` },
  { id: 'right500', name: '五百题将', emoji: '⚔️', desc: '累计答对 500 题',
    check: (c) => c.totalCorrect >= 500,  progress: (c) => `${c.totalCorrect}/500` },
  { id: 'right1000', name: '千题侯',  emoji: '🛡️', desc: '累计答对 1000 题',
    check: (c) => c.totalCorrect >= 1000, progress: (c) => `${c.totalCorrect}/1000` },
  { id: 'fixer',    name: '知错就改', emoji: '🔧', desc: '完成 1 次错题重练',
    check: (c) => c.mistakeSessions >= 1 },
  { id: 'fixer10',  name: '错题克星', emoji: '🩹', desc: '完成 10 次错题重练',
    check: (c) => c.mistakeSessions >= 10, progress: (c) => `${c.mistakeSessions}/10` },
]

// 已获得/未获得分组的勋章墙数据
export function badgeWall(ctx: BadgeContext = buildBadgeContext()): { earned: Badge[]; pending: Array<{ badge: Badge; hint: string | null }> } {
  const earned: Badge[] = []
  const pending: Array<{ badge: Badge; hint: string | null }> = []
  for (const b of BADGES) {
    if (b.check(ctx)) earned.push(b)
    else pending.push({ badge: b, hint: b.progress?.(ctx) ?? null })
  }
  return { earned, pending }
}

// 已获得勋章 id 集合（练习前后快照 diff 用）
export function earnedIds(ctx: BadgeContext = buildBadgeContext()): Set<string> {
  return new Set(BADGES.filter((b) => b.check(ctx)).map((b) => b.id))
}

// 结算页用：对比练习前后，找出本次新获得的勋章（App 在 saveSession 前后各取一次）
export function diffBadges(before: Set<string>, after: Set<string>): Badge[] {
  return BADGES.filter((b) => !before.has(b.id) && after.has(b.id))
}
