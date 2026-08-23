import { config } from '../config.ts'

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

// OpenAI 兼容 chat 调用（DeepSeek/Kimi/GLM/MiniMax 通用）
export async function chat(messages: ChatMessage[], maxTokens = 1200): Promise<string> {
  const { baseUrl, apiKey, model, provider } = config.llm
  if (!apiKey) throw new Error(`LLM_API_KEY 未配置（provider=${provider}）`)
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    throw new Error(`LLM 请求失败：HTTP ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('LLM 返回为空')
  return text
}
