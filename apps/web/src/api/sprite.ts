// 小精灵今日建议（服务端 agent 决策）：画像上下文进，开口内容出
// 失败/沉默返回 null，前端用本地规则兜底（sprite.ts spriteAdvice）
import { syncEnabled, getFamilyId } from '../lib/sync'

export interface SpriteAdviceReq {
  grade: number
  patterns?: { sign?: number; carry?: number; calc?: number; word?: number }
  dailyDone?: boolean
  dailyDays?: number
  recommendReason?: string
}

export async function fetchSpriteAdvice(req: SpriteAdviceReq): Promise<string | null> {
  try {
    const familyId = syncEnabled() ? getFamilyId() : null
    const res = await fetch('/api/sprite-advice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...req, familyId: familyId ?? undefined }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { text?: string | null }
    return data.text?.trim() || null
  } catch {
    return null
  }
}
