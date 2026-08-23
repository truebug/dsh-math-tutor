// DSH 插件壳：把纯函数核心注册为面向模型的工具。
// 出题/判分逻辑见 ./core.ts（浏览器端直接复用，本壳只做注册）。
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { generateQuestions, gradeSession, type Op } from './core.js'

export const name = 'math-generator'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'generate_arithmetic',
    description: '确定性生成小学算术练习题（出题与判分均由代码完成，不经过 LLM）。',
    parameters: {
      count: { type: 'number', required: true, description: '题目数量，1-100' },
      ops: { type: 'string', description: '运算符集合，如 "add,sub"，默认 add,sub' },
      max: { type: 'number', description: '结果上限（如 100），默认 100' },
      seed: { type: 'number', description: '随机种子，便于复现同一份练习（对战同题）' },
    },
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            index: { type: 'number' },
            text: { type: 'string' },
            answer: { type: 'number' },
          },
        },
      },
      render: (_args, value: Array<{ text: string }>) => [
        { type: 'text', text: value.map((q, i) => `${i + 1}. ${q.text} ?`).join('\n') },
      ],
    },
    async execute(args) {
      const count = Math.min(Math.max(Math.trunc(args.count), 1), 100)
      const ops = (args.ops?.split(',').map((s: string) => s.trim()).filter(Boolean) ?? ['add', 'sub']) as Op[]
      return generateQuestions({
        count,
        ops,
        max: args.max ?? 100,
        seed: args.seed ?? Date.now(),
      }).map(({ index, text, answer }) => ({ index, text, answer }))
    },
  }))
}

export { generateQuestions, gradeSession, mulberry32 } from './core.js'
import { mulberry32 } from './core.js'
