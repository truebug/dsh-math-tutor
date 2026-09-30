// 语音对话场景：孩子对小精灵说话（浏览器语音转文字），小精灵口语化回应
// 复用 agent 网关（dsh 默认 + kimi 降级）+ 会话锚点（familyId→sessionId，小精灵记得孩子）
// 红线：音频不出设备（浏览器内识别）；只上传转写文本
import { respond } from '../services/agent.ts'
import { buildLearnerContext, goalProgress } from '../services/learnerCtx.ts'
import type { ServerContext } from '../host.ts'
import { mkdirSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

const METRICS_FILE = join(process.cwd(), 'data', 'chat-metrics.jsonl')

// 语音链路埋点：只记次数与输入方式（voice/text），不含对话内容
function trackChat(viaVoice: boolean): void {
  try {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true })
    appendFileSync(METRICS_FILE, JSON.stringify({ d: new Date().toISOString().slice(0, 10), v: viaVoice ? 1 : 0 }) + '\n')
  } catch { /* 埋点失败不影响对话 */ }
}

export interface ChatRequest {
  grade: 2 | 3 | 4 | 5
  message: string         // 语音转写文本（可能含同音错字）
  familyId?: string       // 已开启云端同步时，会话锚点（小精灵记得这孩子）
  viaVoice?: boolean      // 语音输入（true）或打字降级（false）
}

// 语音识别错词 → 正确教学术语（第 0 步实测暴露的失败模式：通用语言模型不识领域词）
const TERM_FIX: Array<[RegExp, string]> = [
  [/正推卫|进退味|进错位|进退未/g, '进退位'],
  [/手机铃|小精灵灵|小林灵/g, '小精灵'],
  [/凑十法|凑十发/g, '凑十法'],
  [/乘法口决|惩罚口诀/g, '乘法口诀'],
]

function fixTerms(text: string): string {
  let out = text
  for (const [re, to] of TERM_FIX) out = out.replace(re, to)
  return out
}

const SYSTEM = `你是藏在寻宝地图里的小精灵，陪孩子（{grade}年级）聊天。孩子刚才对你说话了。
要求：
1. 像好朋友一样回应，口语化，不超过 60 字
2. 孩子的话是语音识别来的，可能有同音错字，按上下文理解
3. 涉及学习内容就温柔引导；纯闲聊就轻松回应，但慢慢把话题带回学习
4. 不用 markdown，不提 AI、模型、数据等词
5. 如果孩子的问题超出你的知识（比如要你查实时信息），老实说「这个我还不知道，我们一起找找答案吧」`

export async function buildChatReply(req: ChatRequest, provider?: string): Promise<string> {
  const fixed = fixTerms(req.message)
  const ctx = req.familyId ? buildLearnerContext(req.familyId) : null
  const goal = req.familyId ? goalProgress(req.familyId) : null
  const user = [
    `孩子对你说：${fixed}`,
    ctx ? `孩子近期情况：${ctx}` : '',
    goal ? `周目标进度：${goal}` : '',
  ].filter(Boolean).join('\n')
  return respond({
    scene: 'chat',
    familyId: req.familyId,
    provider,
    maxTokens: 300,
    messages: [
      { role: 'system', content: SYSTEM.replace('{grade}', String(req.grade)) },
      { role: 'user', content: user },
    ],
  })
}

export const name = 'chat'
export function apply(ctx: ServerContext) {
  ctx.routes.register('/api/chat', 'POST', async (_req, res, url, body) => {
    const b = body as ChatRequest
    if (!b || typeof b.grade !== 'number' || typeof b.message !== 'string' || !b.message.trim() || b.message.length > 500) {
      res.writeHead(400, { 'content-type': 'application/json' }); res.end('{"error":"bad_request"}')
      return true
    }
    trackChat(!!b.viaVoice)
    try {
      const text = await buildChatReply(b, url.searchParams.get('provider') ?? undefined)
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ text }))
    } catch {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ text: '小精灵刚才走神了，再说一次好吗？' }))
    }
    return true
  })
}
