// dsh provider：DeepSeek Harness 运行时（SDK client spawn 子进程，stdio JSON-RPC）
// 0.1.5 线（2026-09-27 升级，docs/dsh-adoption-report-20260927.md）：
// - 启动方式 = dsh CLI + profile 'sdk' + tutor.patch.yml 叠加层（cordis.yml 已废弃）
//   base profile 自带 llm/session/持久化/工具/凭证全套
// - Kimi 接入零 patch：DEEPSEEK_BASE_URL / DEEPSEEK_API_KEY env 注入子进程
//   （env 优先级最高，官方机制）；models/thinking/persona 差异走 dsh-runtime/tutor.patch.yml
// - dsh 可执行文件由 client 依 import.meta.resolve 自动解析同版本 @deepseek-ai/dsh，
//   子进程默认用当前 node（服务器 /opt/node22 v22.19 ≥ 22.15 ✅）
// - 会话锚点落盘 $DSH_HOME/sessions/（systemd 注入 DSH_HOME=/var/lib/dsh-tutor）
// - stdout 即协议：子进程诊断全走 stderr（tutor.patch.yml 不得引入 stdout logger）
import { config } from '../config.ts'

export interface DshRequest {
  messages: Array<{ role: 'system' | 'user'; content: string }>
  maxTokens?: number
  familyId?: string   // 会话锚点：同一孩子的会话复用（agent 记得孩子）
}

// 最小结构类型：与 0.1.5 SDK client 公共 API 对齐（运行时实例从 dsh-runtime 动态加载，
// 不走主应用 node_modules，避免与残留旧版 client 类型/版本混淆）
interface DshHarness {
  run(prompt: string, opts?: { sessionId?: string }): Promise<{ finalResponse?: string }>
  close(): Promise<void>
}
type DshHarnessCtor = new (opts: Record<string, unknown>) => DshHarness

let harness: DshHarness | null = null
let booting: Promise<DshHarness> | null = null

async function getHarness(): Promise<DshHarness> {
  if (harness) return harness
  booting ??= (async () => {
    // 关键：从 dsh-runtime/node_modules 加载 client（而非主应用 node_modules），
    // 使 client 内部 import.meta.resolve('@deepseek-ai/dsh') 解析到同目录的同版本 dsh
    const clientUrl = new URL('../../dsh-runtime/node_modules/@deepseek-ai/dsh-sdk-client/lib/index.js', import.meta.url).href
    const { DeepSeekHarness } = (await import(clientUrl)) as { DeepSeekHarness: DshHarnessCtor }
    const h = new DeepSeekHarness({
      profile: 'sdk',
      patches: [new URL('../../dsh-runtime/tutor.patch.yml', import.meta.url).pathname],
      provider: 'deepseek-official',
      model: config.llm.model,
      maxTokens: 1024,
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: config.llm.apiKey,
        DEEPSEEK_BASE_URL: config.llm.baseUrl,
        // DSH_HOME 由宿主环境（systemd）提供；本地未设时落到 dsh-runtime/.dsh-home
        DSH_HOME: process.env.DSH_HOME ?? new URL('../../dsh-runtime/.dsh-home/', import.meta.url).pathname,
      },
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

// dsh 模式回复：system+user 拼成单条 prompt（persona 由 tutor.patch.yml 的 system-prompt 提供）
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

// 健康检查：dsh 运行时能否正常启动并返回（用于部署后验证，防止配置错误静默降级）
export async function dshHealthCheck(): Promise<{ ok: boolean; error?: string }> {
  try {
    const h = await getHarness()
    const r = await h.run('hi', { sessionId: 'health-check' })
    if (!r.finalResponse) return { ok: false, error: 'empty_response' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
