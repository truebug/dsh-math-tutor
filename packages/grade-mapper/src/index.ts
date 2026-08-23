import type { Context } from '@deepseek-ai/cordis'
import { knowledgePoints } from './grades.js'

export const name = 'grade-mapper'

export function apply(ctx: Context) {
  ctx.on('ready', () => {
    ctx.logger?.info(`[grade-mapper] loaded ${knowledgePoints.length} knowledge points`)
  })
}

export { knowledgePoints }
