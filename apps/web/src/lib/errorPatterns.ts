import type { Question } from '@dsh-math-tutor/math-generator/core'

export type ErrorKind = 'sign' | 'carry' | 'calc'

export interface PatternStat {
  sign: number   // 看错符号：加法当减法做（或反之）
  carry: number  // 进退位失误：答案差 10（忘进位/忘退位）
  calc: number   // 其他计算错误
}

// 基于「孩子答案与正确答案的关系」的确定性错因分类
export function classifyError(q: Question, given: number | null): ErrorKind | null {
  if (given === null) return null
  const { a, b, op, answer } = q
  // 看错符号：加法做成减法，或减法做成加法
  if (op === 'add' && given === Math.abs(a - b)) return 'sign'
  if (op === 'sub' && given === Math.min(a + b, 100) && given !== answer) return 'sign'
  // 进退位失误：差值恰好为 10（忘进 1 / 忘退 1）
  if (q.carry && Math.abs(given - answer) === 10) return 'carry'
  return 'calc'
}

export const PATTERN_LABELS: Record<ErrorKind, string> = {
  sign: '看错符号',
  carry: '进退位失误',
  calc: '计算错误',
}

export function dominantAdvice(stat: PatternStat): string {
  const total = stat.sign + stat.carry + stat.calc
  if (total === 0) return ''
  const entries = (Object.entries(stat) as Array<[ErrorKind, number]>).sort((x, y) => y[1] - x[1])
  const [kind, n] = entries[0]
  if (n < 2) return ''
  const tips: Record<ErrorKind, string> = {
    sign: `最近有 ${n} 次把符号看反了，做题前先指一指「+」还是「−」再动笔`,
    carry: `最近有 ${n} 次进退位出错，记住口诀：满十写 1 在旁边，借位先点个小圆点`,
    calc: `最近有 ${n} 次计算错误，可以试试放慢一点、做完回头检查一遍`,
  }
  return tips[kind]
}
