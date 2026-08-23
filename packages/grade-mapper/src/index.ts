import type { Context } from '@deepseek-ai/cordis'
import { knowledgePoints } from './grades.js'

export const name = 'grade-mapper'

export function apply(_ctx: Context) {
  // 沪教版知识点映射（MVP 占位）：后续以工具/服务形式暴露给 agent
  void knowledgePoints
}

export { knowledgePoints }
