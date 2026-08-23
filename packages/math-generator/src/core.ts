// 纯函数出题核心：框架无关，可在浏览器与 DSH 插件中复用。
// 多人竞技的基础：同一 seed + 同一参数 = 同一份题目（确定性）。

export type Op = 'add' | 'sub'

export interface GenOptions {
  count: number
  max: number
  ops: Op[]
  seed: number
}

export interface Question {
  index: number
  a: number
  b: number
  op: Op
  text: string
  answer: number
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

function genQuestion(index: number, op: Op, max: number, rng: () => number): Question {
  let a: number
  let b: number
  if (op === 'add') {
    a = randInt(0, max, rng)
    b = randInt(0, max - a, rng)
  } else {
    a = randInt(0, max, rng)
    b = randInt(0, a, rng)
  }
  return {
    index,
    a,
    b,
    op,
    text: `${a} ${op === 'add' ? '+' : '−'} ${b} =`,
    answer: op === 'add' ? a + b : a - b,
  }
}

export function generateQuestions(options: GenOptions): Question[] {
  const rng = mulberry32(options.seed)
  const ops: Op[] = options.ops.length > 0 ? options.ops : ['add', 'sub']
  return Array.from({ length: options.count }, (_, i) =>
    genQuestion(i, ops[Math.floor(rng() * ops.length)], options.max, rng),
  )
}

// 输入归一化：全角数字/负号转半角，去空白；非法输入返回 null
export function normalizeAnswer(raw: string): number | null {
  const s = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[−–]/g, '-')
    .trim()
  if (s === '' || !/^-?\d+$/.test(s)) return null
  return Number(s)
}

export interface GradeResult {
  total: number
  answered: number
  correct: number
  wrongIndexes: number[]
  accuracy: number
  perQuestionMs: number[]
}

export function gradeSession(
  questions: Question[],
  answers: Array<number | null>,
  perQuestionMs: number[],
): GradeResult {
  let correct = 0
  let answered = 0
  const wrongIndexes: number[] = []
  questions.forEach((q, i) => {
    const ans = answers[i]
    if (ans !== null && ans !== undefined) {
      answered += 1
      if (ans === q.answer) correct += 1
      else wrongIndexes.push(i)
    }
  })
  return {
    total: questions.length,
    answered,
    correct,
    wrongIndexes,
    accuracy: answered > 0 ? correct / answered : 0,
    perQuestionMs,
  }
}
