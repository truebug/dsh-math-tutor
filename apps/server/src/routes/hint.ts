// 小精灵讲解：答错后点击触发，LLM 生成简短儿童友好讲解（不携带身份信息）
import { chat } from '../services/llm.ts'

export interface HintRequest {
  grade: 2 | 3 | 4 | 5
  question: string        // 如 "48 + 37 =" 或 "大写 G 的小写是哪个？"
  wrongAnswer: string     // 孩子给的答案
  correctAnswer: string
}

const SYSTEM = `你是一位温柔的小学{grade}年级助教小精灵。孩子答错了一道题。
用不超过 60 字、孩子能懂的话讲解正确思路（可以给出答案），语气鼓励不批评。
不用 markdown，不要提 AI、模型等词。`

export async function buildHint(req: HintRequest): Promise<string> {
  return chat([
    { role: 'system', content: SYSTEM.replace('{grade}', String(req.grade)) },
    { role: 'user', content: `题目：${req.question}\n孩子答：${req.wrongAnswer}\n正确答案：${req.correctAnswer}` },
  ], 300)
}
