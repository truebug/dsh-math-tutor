// 英语大陆内容生成器：确定性出题（种子可复现，支持竞赛码/每日挑战语义）
// 首关内容选取教材无关的通用基础：26 字母 + M1 常见问候词
// （沪教牛津版具体单元词表待实体书核对后扩充，见 docs/curriculum/english.md）
import { mulberry32, type Question } from '@dsh-math-tutor/math-generator/core'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// 字母关：给大写选小写（四选一）
export function generateLetterQuestions(seed: number, from: number, to: number, count: number): Question[] {
  const rng = mulberry32(seed)
  const pool = LETTERS.slice(from, to)
  const picked = [...pool]
  // 洗牌后取 count 个字母
  for (let i = picked.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[picked[i], picked[j]] = [picked[j], picked[i]]
  }
  return picked.slice(0, Math.min(count, picked.length)).map((upper, index) => {
    const correct = upper.toLowerCase()
    const distract = new Set<string>()
    while (distract.size < 3) {
      const d = LETTERS[Math.floor(rng() * 26)].toLowerCase()
      if (d !== correct) distract.add(d)
    }
    const options = [correct, ...distract]
    for (let i = options.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[options[i], options[j]] = [options[j], options[i]]
    }
    return {
      index, a: 0, b: 0, op: 'add' as const,
      text: `大写 ${upper} 的小写是哪个？`,
      answer: 0, carry: false, options, answerText: correct,
    }
  })
}

// 问候词关：英文选中文（四选一）。二年级入门高频词
const GREETINGS: Array<[string, string]> = [
  ['hello', '你好'], ['hi', '嗨/你好'], ['goodbye', '再见'], ['morning', '早上'],
  ['afternoon', '下午'], ['thank you', '谢谢'], ['yes', '是的'], ['no', '不是'],
  ['sorry', '对不起'], ['please', '请'],
]

export function generateGreetingQuestions(seed: number, count: number): Question[] {
  const rng = mulberry32(seed)
  const picked = [...GREETINGS]
  for (let i = picked.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[picked[i], picked[j]] = [picked[j], picked[i]]
  }
  return picked.slice(0, Math.min(count, picked.length)).map(([en, zh], index) => {
    const distract = new Set<string>()
    while (distract.size < 3) {
      const d = GREETINGS[Math.floor(rng() * GREETINGS.length)][1]
      if (d !== zh) distract.add(d)
    }
    const options = [zh, ...distract]
    for (let i = options.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[options[i], options[j]] = [options[j], options[i]]
    }
    return {
      index, a: 0, b: 0, op: 'add' as const,
      text: `"${en}" 的中文意思是？`,
      answer: 0, carry: false, options, answerText: zh,
    }
  })
}
