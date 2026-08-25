// 家长周报（P3）：LLM 基于一周画像生成成长简报（不含身份信息）
import { chat } from '../services/llm.ts'
import type { ServerContext } from '../host.ts'
import { loadProfile } from './profile.ts'

interface SessionLite {
  date?: string
  settings?: { subject?: string }
  total?: number
  correct?: number
  usedMs?: number
  answered?: number
}

const SUBJECT_NAMES: Record<string, string> = { math: '数学', chinese: '语文', english: '英语' }

export async function buildWeeklyReport(familyId: string): Promise<string | null> {
  const doc = loadProfile(familyId)
  if (!doc) return null
  const sessions = ((doc.sessions ?? []) as SessionLite[]).filter((s) => {
    if (!s.date) return false
    return Date.now() - new Date(s.date).getTime() < 7 * 86400000
  })
  if (sessions.length === 0) return null

  const totalQ = sessions.reduce((n, s) => n + (s.answered ?? 0), 0)
  const totalC = sessions.reduce((n, s) => n + (s.correct ?? 0), 0)
  const acc = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0
  const days = new Set(sessions.map((s) => s.date!.slice(0, 10))).size
  const bySubject: Record<string, { q: number; c: number }> = {}
  for (const s of sessions) {
    const sub = s.settings?.subject ?? 'math'
    bySubject[sub] ??= { q: 0, c: 0 }
    bySubject[sub].q += s.answered ?? 0
    bySubject[sub].c += s.correct ?? 0
  }
  const subjectLine = Object.entries(bySubject)
    .map(([k, v]) => `${SUBJECT_NAMES[k] ?? k} ${v.q}题（正确率${v.q > 0 ? Math.round((v.c / v.q) * 100) : 0}%）`)
    .join('，')

  const pd = doc.profileData as { patterns?: Record<string, number> } | null
  const labels: Record<string, string> = { sign: '看错符号', carry: '进退位失误', calc: '计算错误', word: '字词记忆' }
  const topPattern = Object.entries(pd?.patterns ?? {}).sort((a, b) => b[1] - a[1])[0]

  const summary = [
    `本周练习${sessions.length}次、${days}天有学习，共${totalQ}题，总正确率${acc}%。`,
    `分科情况：${subjectLine}。`,
    topPattern && topPattern[1] > 0 ? `主要薄弱点：${labels[topPattern[0]] ?? topPattern[0]}（累计${topPattern[1]}次）。` : '',
  ].join('\n')

  return chat([
    { role: 'system', content: `你是孩子的学习成长顾问，给家长写本周简报。要求：先说进步和亮点，再温和指出一个最值得关注的薄弱点和一条具体可执行的家庭配合建议。不超过 150 字，语气温和专业，不用 markdown，不提 AI。` },
    { role: 'user', content: summary },
  ], 400)
}

export const name = 'weekly'
export function apply(ctx: ServerContext) {
  ctx.routes.register('/api/weekly-report', 'GET', async (_req, res, url) => {
    const familyId = url.searchParams.get('familyId') ?? ''
    const json = (status: number, b: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)) }
    if (!familyId) { json(400, { error: 'family_id_required' }); return true }
    try {
      const text = await buildWeeklyReport(familyId)
      text ? json(200, { text }) : json(404, { error: 'no_data_this_week' })
    } catch (e) {
      json(502, { error: e instanceof Error ? e.message : 'llm_error' })
    }
    return true
  })
}
