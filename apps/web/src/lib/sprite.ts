// 小精灵决策入口（三层契约之"决策层"前端侧）
// 现在：确定性规则集，纯函数 JSON 进 JSON 出
// 将来：接 dsh 时此函数内部改为调用 agent（UI 层零感知，见 docs/roadmap-agent.md 迁移映射）
import type { AdventureState } from './adventure'
import { loadProfileData } from './profile'
import { dominantAdvice } from './errorPatterns'

export interface SpriteContext {
  adventure: AdventureState
  dailyDone: boolean
  recommendReason: string | null
}

// 今日建议：打开地图时小精灵主动开口（无画像数据/无事可说时返回 null）
export function spriteAdvice(ctx: SpriteContext): string | null {
  const pd = loadProfileData()
  const tip = dominantAdvice(pd.patterns)
  if (tip) return `今天开始之前：${tip}`
  if (Object.keys(ctx.adventure.daily).length > 0 && !ctx.dailyDone) {
    return '今天还没打卡每日挑战哦，完成后有加分奖励！'
  }
  if (ctx.recommendReason) return `我看好你哦～${ctx.recommendReason}`
  return null
}
