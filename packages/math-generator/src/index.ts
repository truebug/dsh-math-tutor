import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'math-generator'
export const inject = ['tools']

type Op = 'add' | 'sub'

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

function genQuestion(op: Op, max: number, rng: () => number) {
  if (op === 'add') {
    const a = randInt(0, max, rng)
    const b = randInt(0, max - a, rng)
    return { text: `${a} + ${b} = ?`, answer: a + b }
  }
  const a = randInt(0, max, rng)
  const b = randInt(0, a, rng)
  return { text: `${a} - ${b} = ?`, answer: a - b }
}

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'generate_arithmetic',
    description: '确定性生成小学算术练习题（出题与判分均由代码完成，不经过 LLM）。',
    parameters: {
      count: { type: 'number', required: true, description: '题目数量，1-50' },
      ops: { type: 'string', description: '运算符集合，如 "add,sub"，默认 add,sub' },
      max: { type: 'number', description: '结果上限（如 100），默认 100' },
      seed: { type: 'number', description: '随机种子，便于复现同一份练习' },
    },
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: { type: 'string' },
            answer: { type: 'number' },
          },
        },
      },
      render: (_args, value: Array<{ text: string }>) => [
        { type: 'text', text: value.map((q, i) => `${i + 1}. ${q.text}`).join('\n') },
      ],
    },
    async execute(args) {
      const count = Math.min(Math.max(Math.trunc(args.count), 1), 50)
      const max = args.max ?? 100
      const ops = (args.ops?.split(',').map((s) => s.trim()).filter(Boolean) ?? ['add', 'sub']) as Op[]
      let state = (args.seed ?? Date.now()) >>> 0
      const rng = () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 0x100000000
      }
      return Array.from({ length: count }, () => genQuestion(ops[Math.floor(rng() * ops.length)], max, rng))
    },
  }))
}
