// 本地学习者画像：agent 记忆的基础数据（积累层）。
// 确定性统计 + AI 点评历史，全部仅存 localStorage（上传需监护人同意，见 docs/vision.md）。

import { classifyError, type PatternStat } from './errorPatterns'
import type { Question } from '@dsh-math-tutor/math-generator/core'
import { pushProfile } from './sync'
import type { SessionRecord } from './types'

// 直接读 sessions 键，避免与 storage.ts 循环依赖（storage → sync → profile）
function readSessions(): SessionRecord[] {
  try {
    return JSON.parse(localStorage.getItem('dsh-math-tutor:sessions') ?? '[]')
  } catch {
    return []
  }
}

export interface ProfileData {
  carryWrong: number      // 进位/退位题累计错误
  carryTotal: number      // 进位/退位题累计作答
  plainWrong: number
  plainTotal: number
  patterns: PatternStat   // 错因聚类：看错符号/进退位失误/计算错误
  sessions: number
  reviews: Array<{ date: string; sessionId: string; text: string }>  // AI 点评历史
}

const KEY = 'dsh-math-tutor:profile-data'

export function loadProfileData(): ProfileData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fallthrough */ }
  return { carryWrong: 0, carryTotal: 0, plainWrong: 0, plainTotal: 0, patterns: { sign: 0, carry: 0, calc: 0, word: 0 }, sessions: 0, reviews: [] }
}

export function saveProfileData(p: ProfileData): void {
  localStorage.setItem(KEY, JSON.stringify(p))
  pushProfile()
}

// 每次练习后增量更新画像（确定性，不走 LLM）
export function accumulateSession(
  questions: Question[],
  wrongIndexes: number[],
  answers: Array<number | string | null>,
): ProfileData {
  const p = loadProfileData()
  p.patterns ??= { sign: 0, carry: 0, calc: 0, word: 0 }
  const wrong = new Set(wrongIndexes)
  questions.forEach((q, i) => {
    if (q.carry) {
      p.carryTotal += 1
      if (wrong.has(i)) p.carryWrong += 1
    } else {
      p.plainTotal += 1
      if (wrong.has(i)) p.plainWrong += 1
    }
    if (wrong.has(i)) {
      const kind = classifyError(q, answers[i] ?? null)
      if (kind) p.patterns[kind] += 1
    }
  })
  p.sessions += 1
  saveProfileData(p)
  return p
}

// AI 点评结果落记忆（最近保留 50 条）
export function saveReview(sessionId: string, text: string): void {
  const p = loadProfileData()
  p.reviews.unshift({ date: new Date().toISOString(), sessionId, text })
  p.reviews = p.reviews.slice(0, 50)
  saveProfileData(p)
}

// 画像摘要：将来注入 LLM prompt / agent.inject() 的同一份资产
export function profileSummary(): string {
  const p = loadProfileData()
  if (p.sessions === 0) return '尚无练习记录'
  const carryAcc = p.carryTotal > 0 ? Math.round((1 - p.carryWrong / p.carryTotal) * 100) : null
  const plainAcc = p.plainTotal > 0 ? Math.round((1 - p.plainWrong / p.plainTotal) * 100) : null
  return `累计练习${p.sessions}次；进退位题正确率${carryAcc ?? '-'}%，基础题正确率${plainAcc ?? '-'}%`
}

// 画像反哺出题：根据进退位题历史正确率调整下一组的进退位占比。
// 样本不足（<20 道进退位题）不动；仅在个人日常练习启用，竞赛码对战锁定档位默认。
export function adaptiveCarryRatio(base: number): { ratio: number; applied: boolean; reason: string } {
  const p = loadProfileData()
  if (p.carryTotal < 20) return { ratio: base, applied: false, reason: '' }
  const acc = 1 - p.carryWrong / p.carryTotal
  if (acc < 0.8) {
    const ratio = Math.min(0.85, base + 0.25)
    return { ratio, applied: true, reason: `进退位正确率 ${Math.round(acc * 100)}%，已增加进退位题加强练习` }
  }
  if (acc > 0.95 && base > 0.4) {
    const ratio = Math.max(0.3, base - 0.2)
    return { ratio, applied: true, reason: '进退位已熟练掌握，适当增加基础题保持手感' }
  }
  return { ratio: base, applied: false, reason: '' }
}

// 画像反哺关卡参数（P2）：按该关最近成绩微调题量与限时
// 连续高正确率 → 加量提速（吃不饱）；正确率低 → 减量减压（跟不上）
export function adaptiveStageTune(stageId: string, baseCount: number, baseSec: number): { count: number; durationSec: number; reason: string } {
  const sessions = readSessions().filter((s) => s.settings.stageId === stageId && s.answered > 0)
  if (sessions.length < 2) return { count: baseCount, durationSec: baseSec, reason: '' }
  const recent = sessions.slice(0, 2)  // 最近两次（sessions 按时间倒序存）
  const accs = recent.map((s) => s.correct / Math.max(s.total, 1))
  const avgAcc = accs.reduce((a, b) => a + b, 0) / accs.length
  if (avgAcc >= 0.95 && baseCount < 60) {
    return {
      count: Math.min(60, Math.round(baseCount * 1.25)),
      durationSec: baseSec,
      reason: '这关最近表现很棒，题量+25% 挑战一下',
    }
  }
  if (avgAcc < 0.7 && baseCount > 10) {
    return {
      count: Math.max(10, Math.round(baseCount * 0.8)),
      durationSec: baseSec,
      reason: '这关最近有点吃力，先减量稳扎稳打',
    }
  }
  return { count: baseCount, durationSec: baseSec, reason: '' }
}
