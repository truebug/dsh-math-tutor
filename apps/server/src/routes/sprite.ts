// 小精灵今日建议（sprite 场景）：画像上下文进，agent 自主决定说什么
// 灰度第三步：默认走 dsh（真 agent 决策），异常自动降级 kimi 直调；前端另有本地规则兜底
import { respond } from '../services/agent.ts'
import { buildLearnerContext, goalProgress } from '../services/learnerCtx.ts'
import type { ServerContext } from '../host.ts'

export interface SpriteAdviceRequest {
  grade: 2 | 3 | 4 | 5
  patterns?: { sign?: number; carry?: number; calc?: number; word?: number }  // 前端画像错因计数
  dailyDone?: boolean       // 今日每日挑战是否已完成
  dailyDays?: number        // 累计打卡天数
  recommendReason?: string  // 当前推荐关及原因（规则层产出）
  familyId?: string         // 已开启云端同步时，服务端注入画像 + 会话锚点
}

const SYSTEM = `你是藏在寻宝地图里的小精灵，陪孩子（{grade}年级）一起学语文、数学和英语。
现在孩子刚打开地图，你要主动说一句话。要求：
1. 根据孩子的学习情况，决定此刻最该说什么：有薄弱点就温柔提醒先练什么，没打卡就招呼打卡，都没有就给推荐关加油
2. 不超过 40 字，语气活泼温暖，像好朋友，不说教
3. 不用 markdown，不要提 AI、模型、数据等词
4. 如果实在没什么值得说的（比如孩子刚注册还没练过），只回复两个字：沉默

错因到建议的映射规则：
- 进退位失误 ≥2 次：建议先练进退位专项，语气鼓励（如「进位退位再练练，马上就更稳啦」）
- 看错符号 ≥2 次：提醒「做题前先看清 + 还是 −，不着急」
- 字词记忆 ≥2 次：建议先去错题本复习，再回来挑战
- 今日未打卡：招呼「今天还没打卡，来一关热热身吧」
- 全部答对/无错题：给推荐关加油（如「状态超好，试试新关卡吧」）`

function buildUser(req: SpriteAdviceRequest, ctx: string | null): string {
  const p = req.patterns ?? {}
  const entries = Object.entries(p).filter(([, n]) => (n ?? 0) > 0)
  const labels: Record<string, string> = { sign: '看错符号', carry: '进退位失误', calc: '计算错误', word: '字词记忆' }
  const patternLine = entries.length > 0
    ? `错题错因统计：${entries.map(([k, n]) => `${labels[k] ?? k}${n}次`).join('、')}`
    : '还没有错题记录'
  return [
    patternLine,
    `今日打卡：${req.dailyDone ? '已完成' : '未完成'}，累计打卡 ${req.dailyDays ?? 0} 天`,
    req.recommendReason ? `当前推荐：${req.recommendReason}` : '',
    ctx ? `孩子近期情况：${ctx}` : '',
  ].filter(Boolean).join('\n')
}

export async function buildSpriteAdvice(req: SpriteAdviceRequest, provider?: string): Promise<string | null> {
  const ctx = req.familyId ? buildLearnerContext(req.familyId) : null
  const goal = req.familyId ? goalProgress(req.familyId) : null
  const chain = provider ? [provider] : ['dsh', 'kimi']
  for (const p of chain) {
    try {
      const system = SYSTEM.replace('{grade}', String(req.grade))
      const messages = [
        { role: 'system' as const, content: system },
        { role: 'user' as const, content: buildUser(req, ctx) + (goal ? `\n周目标进度：${goal}` : '') },
      ]
      const text = await respond({ scene: 'sprite', familyId: req.familyId, provider: p, maxTokens: 200, messages })
      if (text && !text.includes('沉默')) return text.trim()
      return null
    } catch { /* 降级下一 provider */ }
  }
  return null
}

export const name = 'sprite'
export function apply(ctx: ServerContext) {
  ctx.routes.register('/api/sprite-advice', 'POST', async (_req, res, url, body) => {
    const b = body as SpriteAdviceRequest
    if (!b || typeof b.grade !== 'number') {
      res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'bad_request' }))
      return true
    }
    const text = await buildSpriteAdvice(b, url.searchParams.get('provider') ?? undefined)
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ text }))
    return true
  })
}
