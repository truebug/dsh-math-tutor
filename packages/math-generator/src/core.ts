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

// 质量约束：过滤无训练价值的琐碎题（保证确定性：拒绝采样走同一条 RNG 序列）
function isTrivial(a: number, b: number, op: Op): boolean {
  if (a < 5 || b < 5) return true        // 操作数过小，如 3 + 2、99 + 1
  if (a % 10 === 0 || b % 10 === 0) return true  // 整十口算，如 40 + 30、57 - 40
  if (op === 'sub' && a === b) return true       // 同数相减得 0，如 16 - 16
  return false
}

// 加法是否进位 / 减法是否退位（二年级训练重点）
export function isCarry(a: number, b: number, op: Op): boolean {
  if (op === 'add') return (a % 10) + (b % 10) >= 10
  return (a % 10) < (b % 10)
}

function genQuestion(index: number, op: Op, max: number, rng: () => number, wantCarry: boolean): Question {
  let a = 0
  let b = 0
  for (let tries = 0; tries < 100; tries += 1) {
    if (op === 'add') {
      a = randInt(0, max, rng)
      b = randInt(0, max - a, rng)
    } else {
      a = randInt(0, max, rng)
      b = randInt(0, a, rng)
    }
    if (isTrivial(a, b, op)) continue
    if (isCarry(a, b, op) !== wantCarry) continue
    break
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
  // 约 60% 的题目要求进位/退位（训练重点），其余为非进退位基础题
  return Array.from({ length: options.count }, (_, i) =>
    genQuestion(i, ops[Math.floor(rng() * ops.length)], options.max, rng, rng() < 0.6),
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
