// Agent 网关（三层契约之"决策/表达层"的唯一替换点）
// 现在：respond() 默认走 llm.ts chat()（Kimi/OpenAI 兼容直调）
// 将来：AGENT_PROVIDER=dsh 时改为驱动 dsh 运行时（SDK client → 会话 + 工具调用），
//       review/hint/weekly 三个路由与本文件以外的代码零感知。
//       dsh 发生破坏性变更/临时换别的 agent 框架时，只改本文件 provider 实现。
import { chat, type ChatMessage } from './llm.ts'
import { dshRespond } from './dsh.ts'

export type AgentScene = 'review' | 'hint' | 'weekly'

export interface AgentRequest {
  scene: AgentScene
  messages: ChatMessage[]
  maxTokens?: number
  familyId?: string   // 已开启云端同步的孩子（dsh 模式下用于会话记忆锚点）
  provider?: string   // 请求级覆盖（灰度用：?provider=dsh 只切当前请求）
}

// 统一出口：按场景回复。当前仅 kimi 直调 provider。
export async function respond(req: AgentRequest): Promise<string> {
  const provider = req.provider ?? process.env.AGENT_PROVIDER ?? 'kimi'
  switch (provider) {
    case 'dsh':
      return dshRespond({ messages: req.messages, maxTokens: req.maxTokens, familyId: req.familyId })
    case 'kimi':
    default:
      return chat(req.messages, req.maxTokens)
  }
}
