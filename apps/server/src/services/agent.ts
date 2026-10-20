// Agent 网关（三层契约之"决策/表达层"的唯一替换点）
// 调用链：dsh（启用时）→ 主供应商直接调用 → 独立 fallback；
// 任一环节失败按顺序降级，连续失败由 circuit.ts 熔断，全部失败才向孩子报错。
import { chat, chatFallback, fallbackConfigured, type ChatMessage } from './llm.ts'
import { dshRespond, resetHarness } from './dsh.ts'
import { circuitOpen, recordFailure, recordSuccess } from './circuit.ts'
import { errorCodeOf, logLlmMetric } from './metrics.ts'

export type AgentScene = 'review' | 'hint' | 'weekly' | 'sprite' | 'chat'

export interface AgentRequest {
  scene: AgentScene
  messages: ChatMessage[]
  maxTokens?: number
  familyId?: string   // 已开启云端同步的孩子（dsh 模式下用于会话记忆锚点）
  learnerId?: string  // 匿名学习 ID（未开同步也能有连续记忆）
  provider?: string   // 请求级覆盖（灰度用：?provider=dsh 只切当前请求）
}

export interface AgentResult { text: string; provider: string; degraded: boolean; latencyMs: number }

const DSH_TIMEOUT = 25_000

function providerChain(req: AgentRequest): string[] {
  const base = req.provider
    ? [req.provider]
    : (process.env.AGENT_PROVIDER ?? 'kimi') === 'dsh'
      ? ['dsh', 'kimi']
      : ['kimi']
  const chain = [...base]
  if (fallbackConfigured() && !chain.includes('fallback')) chain.push('fallback')
  return chain
}

async function callDsh(req: AgentRequest): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('dsh timeout')), DSH_TIMEOUT)
  })
  try {
    return await Promise.race([
      dshRespond({
        messages: req.messages,
        maxTokens: req.maxTokens,
        familyId: req.familyId,
        learnerId: req.learnerId,
        scene: req.scene,
      }),
      timeout,
    ])
  } catch (err) {
    if (err instanceof Error && /dsh timeout/.test(err.message)) await resetHarness()
    throw err
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function callProvider(provider: string, req: AgentRequest): Promise<string> {
  switch (provider) {
    case 'dsh': return callDsh(req)
    case 'fallback': return chatFallback(req.messages, req.maxTokens)
    case 'kimi':
    default: return chat(req.messages, req.maxTokens)
  }
}

export async function respondDetailed(req: AgentRequest): Promise<AgentResult> {
  const chain = providerChain(req)
  const started = performance.now()
  const errors: string[] = []
  for (const provider of chain) {
    if (circuitOpen(provider)) { errors.push(`${provider}:circuit_open`); continue }
    const t0 = performance.now()
    try {
      const text = await callProvider(provider, req)
      recordSuccess(provider)
      const ms = Math.round(performance.now() - t0)
      logLlmMetric({ ts: new Date().toISOString(), scene: req.scene, provider, ok: true, degraded: provider !== chain[0], ms })
      return { text, provider, degraded: provider !== chain[0], latencyMs: Math.round(performance.now() - started) }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const { code, status } = errorCodeOf(err)
      recordFailure(provider, msg)
      logLlmMetric({ ts: new Date().toISOString(), scene: req.scene, provider, ok: false, degraded: false, ms: Math.round(performance.now() - t0), errorCode: code, httpStatus: status })
      console.warn(`[agent] ${provider} 失败，尝试下一级:`, msg.slice(0, 300))
      errors.push(`${provider}:${code}`)
    }
  }
  throw new Error(`所有 provider 均失败（${errors.join(', ')}）`)
}

// 兼容旧路由：只要文本
export async function respond(req: AgentRequest): Promise<string> {
  return (await respondDetailed(req)).text
}
