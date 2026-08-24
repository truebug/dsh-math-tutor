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

// 流式 chat：OpenAI 兼容 SSE 解析，逐段产出文本增量（供 /api/hint/stream 转发给孩子）
export async function* chatStream(messages: ChatMessage[], maxTokens = 300): AsyncGenerator<string> {
  const { baseUrl, apiKey, model, provider } = config.llm
  if (!apiKey) throw new Error(`LLM_API_KEY 未配置（provider=${provider}）`)
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, stream: true }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok || !res.body) {
    throw new Error(`LLM 流式请求失败：HTTP ${res.status}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const payload = t.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const delta = (JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> })
          .choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch { /* 忽略半包 */ }
    }
  }
}
