// 学习者上下文服务（P1 画像注入）：从云端画像构建匿名学习摘要，注入 LLM 会话
// 红线：输出不含昵称等身份信息，只含掌握度/错因趋势/节奏
import { loadProfile, type ProfileDoc } from '../routes/profile.ts'

interface PatternStat { sign?: number; carry?: number; calc?: number; word?: number }

interface SessionLite {
  date?: string
  settings?: { stageId?: string; kind?: string; level?: number; subject?: string }
  total?: number
  correct?: number
  usedMs?: number
  answered?: number
}

// 构建注入用画像摘要（agent 每次会话"记得"这个孩子）
export function buildLearnerContext(familyId: string): string | null {
  const doc: ProfileDoc | null = loadProfile(familyId)
  if (!doc) return null
  const parts: string[] = []

  // 错因趋势（确定性统计）
  const pd = doc.profileData as { patterns?: PatternStat } | null
  const p = pd?.patterns
  if (p) {
    const entries = Object.entries(p).filter(([, n]) => (n ?? 0) > 0) as Array<[keyof PatternStat, number]>
    if (entries.length > 0) {
      const labels: Record<string, string> = { sign: '看错符号', carry: '进退位失误', calc: '计算错误', word: '字词记忆' }
      const total = entries.reduce((s, [, n]) => s + n, 0)
      const top = entries.sort((a, b) => b[1] - a[1])[0]
      parts.push(`累计${total}道错题，主要是「${labels[top[0]]}」（${top[1]}次）`)
    }
  }

  // 近期趋势：最近 5 次练习正确率走向
  const sessions = (doc.sessions ?? []) as SessionLite[]
  const recent = sessions.slice(0, 5).filter((s) => typeof s.correct === 'number' && typeof s.total === 'number' && s.total > 0)
  if (recent.length >= 2) {
    const accs = recent.map((s) => Math.round((s.correct! / s.total!) * 100))
    const trend = accs[0] > accs[accs.length - 1] + 5 ? '在进步' : accs[0] < accs[accs.length - 1] - 5 ? '有波动' : '比较稳定'
    parts.push(`最近${recent.length}次练习正确率 ${accs.join('% → ')}%，整体${trend}`)
  }

  // 节奏偏好：平均单题用时
  const withTime = sessions.filter((s) => s.usedMs && s.answered)
  if (withTime.length > 0) {
    const avg = withTime.reduce((s, x) => s + x.usedMs! / Math.max(x.answered!, 1), 0) / withTime.length / 1000
    parts.push(`平均每题约${avg.toFixed(1)}秒（${avg < 4 ? '偏快手型，提醒别粗心' : avg > 10 ? '偏谨慎型，多鼓励' : '节奏正常'}）`)
  }

  return parts.length > 0 ? parts.join('；') : null
}
