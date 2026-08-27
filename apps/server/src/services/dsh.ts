// dsh provider：DeepSeek Harness 运行时（SDK client spawn 子进程，stdio JSON-RPC）
// hint 场景先行灰度。要点（2026-08-27 本地验证，docs/roadmap-agent.md）：
// - Kimi 走 dsh-llm-deepseek 适配器（cordis.yml baseURL 指 Kimi 兼容端点），无需自写适配器
// - Node 需 ≥22.15（持久化插件依赖 zstd）；服务器 /opt/node22 = v22.19.0 ✅
// - 子进程按需 spawn、跨请求复用；崩溃自动重孵
// - stdout 即协议：子进程诊断全走 stderr，cordis.yml 不得挂 stdout logger
import { config } from '../config.ts'

export interface DshRequest {
  messages: Array<{ role: 'system' | 'user'; content: string }>
  maxTokens?: number
  familyId?: string   // 会话锚点：同一孩子的会话复用（agent 记得孩子）
}

let harness: import('@deepseek-ai/dsh-sdk-client').DeepSeekHarness | null = null
let booting: Promise<import('@deepseek-ai/dsh-sdk-client').DeepSeekHarness> | null = null

function dshDir(): string {
  // cordis.yml 与 node_modules 所在（部署时 scp 到 server/dsh-runtime/）
  return new URL('../../dsh-runtime/', import.meta.url).pathname
}

async function getHarness(): Promise<import('@deepseek-ai/dsh-sdk-client').DeepSeekHarness> {
  if (harness) return harness
  booting ??= (async () => {
    const { DeepSeekHarness } = await import('@deepseek-ai/dsh-sdk-client')
    const h = new DeepSeekHarness({
      launch: {
        command: process.execPath,
        args: ['node_modules/@deepseek-ai/dsh-sdk-jsonrpc-demo/lib/bin.js', 'cordis.yml'],
        env: { ...process.env, LLM_API_KEY: config.llm.apiKey },
        cwd: dshDir(),
      },
      provider: 'deepseek-official',
      model: config.llm.model,
      maxTokens: 1024,
    })
    harness = h
    return h
  })()
  try {
    return await booting
  } finally {
    booting = null
  }
}

// 崩溃重孵：transport 断开后丢弃实例，下次调用重新 spawn
async function resetHarness(): Promise<void> {
  const h = harness
  harness = null
  if (h) await h.close().catch(() => {})
}

// dsh 模式回复：system+user 拼成单条 prompt（SDK 不加系统提示词，由 cordis.yml 插件负责）
export async function dshRespond(req: DshRequest): Promise<string> {
  const system = req.messages.find((m) => m.role === 'system')?.content ?? ''
  const user = req.messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n')
  const prompt = system ? `${system}\n\n${user}` : user
  const h = await getHarness()
  try {
    const result = await h.run(prompt, {
      sessionId: req.familyId ? `tutor-${req.familyId}` : undefined,
    })
    if (!result.finalResponse) throw new Error('dsh 返回为空')
    return result.finalResponse
  } catch (err) {
    // transport 级错误重孵一次再抛（模型错误已在事件流里，不吞）
    const msg = err instanceof Error ? err.message : String(err)
    if (/transport|closed|spawn/i.test(msg)) await resetHarness()
    throw err
  }
}
