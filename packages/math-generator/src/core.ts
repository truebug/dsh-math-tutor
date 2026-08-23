// 纯函数出题核心：框架无关，可在浏览器与 DSH 插件中复用。
// 多人竞技的基础：同一 seed + 同一参数 = 同一份题目（确定性）。

export type Op = 'add' | 'sub' | 'mul' | 'div'
export type Level = 1 | 2 | 3

// 难度分级：进退位占比 + 最小操作数（二年级进退位是训练重点）
export const LEVELS: Record<Level, { carryRatio: number; minOperand: number; label: string }> = {
  1: { carryRatio: 0.15, minOperand: 2, label: '基础' },
  2: { carryRatio: 0.6, minOperand: 5, label: '进阶' },
  3: { carryRatio: 0.9, minOperand: 10, label: '挑战' },
}

export interface GenOptions {
  count: number
  max: number
  ops: Op[]
  seed: number
  level?: Level
  carryRatio?: number  // 画像自适应可覆盖档位默认值（对战/竞赛码场景不得使用）
}

export interface Question {
  index: number
  a: number
  b: number
  op: Op
  text: string
  answer: number
  carry: boolean
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

// 质量约束：过滤无训练价值的琐碎题
function isTrivial(a: number, b: number, op: Op, minOperand: number, level: Level): boolean {
  if (op === 'mul' || op === 'div') {
    return a <= 1 || b <= 1                          // ×1 / ÷1 无训练价值
  }
  if (a < minOperand || b < minOperand) return true    // 操作数过小，如 3 + 2、99 + 1
  if (op === 'sub' && a === b) return true             // 同数相减得 0，如 16 - 16
  if (level >= 2 && (a % 10 === 0 || b % 10 === 0)) return true  // 进阶以上剔除整十口算
  return false
}

const OP_GLYPH: Record<Op, string> = { add: '+', sub: '−', mul: '×', div: '÷' }
export const OP_GLYPHS: Record<Op, string> = OP_GLYPH

// 加法是否进位 / 减法是否退位
export function isCarry(a: number, b: number, op: Op): boolean {
  if (op === 'add') return (a % 10) + (b % 10) >= 10
  return (a % 10) < (b % 10)
}

// 难度→九九表范围：基础 2~5，进阶/挑战 2~9
const tableMax = (level: Level) => (level === 1 ? 5 : 9)

function genQuestion(
  index: number, op: Op, max: number, rng: () => number,
  wantCarry: boolean, minOperand: number, level: Level,
): Question {
  let a = 0
  let b = 0
  let answer = 0
  for (let tries = 0; tries < 100; tries += 1) {
    if (op === 'mul') {
      a = randInt(2, tableMax(level), rng)
      b = randInt(2, tableMax(level), rng)
    } else if (op === 'div') {
      b = randInt(2, tableMax(level), rng)           // 除数
      const q = randInt(2, tableMax(level), rng)     // 商
      a = b * q                                       // 被除数（保证整除）
    } else if (op === 'add') {
      a = randInt(0, max, rng)
      b = randInt(0, max - a, rng)
    } else {
      a = randInt(0, max, rng)
      b = randInt(0, a, rng)
    }
    if (isTrivial(a, b, op, minOperand, level)) continue
    if ((op === 'add' || op === 'sub') && isCarry(a, b, op) !== wantCarry) continue
    break
  }
  if (op === 'mul') answer = a * b
  else if (op === 'div') answer = a / b
  else answer = op === 'add' ? a + b : a - b
  return {
    index, a, b, op,
    text: `${a} ${OP_GLYPH[op]} ${b} =`,
    answer,
    carry: op === 'add' || op === 'sub' ? isCarry(a, b, op) : false,
  }
}

export function generateQuestions(options: GenOptions): Question[] {
  const rng = mulberry32(options.seed)
  const ops: Op[] = options.ops.length > 0 ? options.ops : ['add', 'sub']
  const level: Level = options.level ?? 2
  const { carryRatio: levelRatio, minOperand } = LEVELS[level]
  const carryRatio = options.carryRatio ?? levelRatio
  return Array.from({ length: options.count }, (_, i) =>
    genQuestion(i, ops[Math.floor(rng() * ops.length)], options.max, rng, rng() < carryRatio, minOperand, level),
  )
}

// 错题重练：生成「同运算符、同进退位性质」的新题（换数字）
export function generateSimilar(q: Question, rng: () => number, index: number): Question {
  const level: Level = 2
  const { minOperand } = LEVELS[level]
  return genQuestion(index, q.op, 100, rng, q.carry, minOperand, level)
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
