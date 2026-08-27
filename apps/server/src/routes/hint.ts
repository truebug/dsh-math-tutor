// 小精灵讲解：答错后点击触发，LLM 生成简短儿童友好讲解（不携带身份信息）
import { chatStream } from '../services/llm.ts'
import { respond } from '../services/agent.ts'
import { buildLearnerContext } from '../services/learnerCtx.ts'

export interface HintRequest {
  grade: 2 | 3 | 4 | 5
  question: string        // 如 "48 + 37 =" 或 "大写 G 的小写是哪个？"
  wrongAnswer: string     // 孩子给的答案
  correctAnswer: string
  familyId?: string       // P1：画像注入（agent 记得孩子的易错类型）
}

const SYSTEM = `你是一位温柔的小学{grade}年级助教小精灵。孩子答错了一道题。
用不超过 60 字、孩子能懂的话讲解正确思路（可以给出答案），语气鼓励不批评。
不用 markdown，不要提 AI、模型等词。`

export async function buildHint(req: HintRequest): Promise<string> {
  return respond({
    scene: 'hint',
    familyId: req.familyId,
    maxTokens: 300,
    messages: [
      { role: 'system', content: SYSTEM.replace('{grade}', String(req.grade)) },
      { role: 'user', content: hintUser(req) },
    ],
  })
}

export function streamHint(req: HintRequest): AsyncGenerator<string> {
  return chatStream([
    { role: 'system', content: SYSTEM.replace('{grade}', String(req.grade)) },
    { role: 'user', content: hintUser(req) },
  ], 300)
}

function hintUser(req: HintRequest): string {
  const ctx = req.familyId ? buildLearnerContext(req.familyId) : null
  return [
    `题目：${req.question}\n孩子答：${req.wrongAnswer}\n正确答案：${req.correctAnswer}`,
    ctx ? `孩子近期情况：${ctx}（讲解时照顾其薄弱点）` : '',
  ].join('\n')
}

// ===== DSH 插件壳 =====
import type { ServerContext } from '../host.ts'
export const name = 'hint'
export function apply(ctx: ServerContext) {
  ctx.routes.register('/api/hint/stream', 'POST', async (_req, res, _url, body) => {
    const b = body as HintRequest
    if (!b?.question || b.correctAnswer === undefined) {
      res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'bad_request' }))
      return true
    }
    // SSE：x-accel-buffering: no 让 nginx 不缓冲，逐字推送
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    try {
      for await (const delta of streamHint(b)) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`)
      }
      res.write('data: [DONE]\n\n')
    } catch (e) {
      res.write(`data: ${JSON.stringify({ error: e instanceof Error ? e.message : 'llm_error' })}\n\n`)
    }
    res.end()
    return true
  })
  ctx.routes.register('/api/hint', 'POST', async (_req, res, url, body) => {
    const b = body as HintRequest
    if (!b?.question || b.correctAnswer === undefined) {
      res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'bad_request' }))
      return true
    }
    // 灰度：?provider=dsh 仅当前请求走 dsh 运行时（hint 场景先行）
    const provider = url.searchParams.get('provider') ?? undefined
    const text = await respond({
      scene: 'hint',
      familyId: b.familyId,
      provider,
      maxTokens: 300,
      messages: [
        { role: 'system', content: SYSTEM.replace('{grade}', String(b.grade)) },
        { role: 'user', content: hintUser(b) },
      ],
    })
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ text }))
    return true
  })
}
