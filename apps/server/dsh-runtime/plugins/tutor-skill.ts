// 小精灵建议 skill：错因→建议规则包，agent 自主决定何时调用
export const name = 'tutor-skill'

interface SkillContext {
  skills?: { register(skill: Record<string, unknown>): () => void }
}

export function apply(ctx: SkillContext) {
  ctx.skills?.register({
    name: 'tutor-advice-rules',
    description: '错因统计到练习建议的映射规则：进退位失误→加练进退位专项，看错符号→提醒慢一点检查符号，字词记忆→先复习再做题',
    instructions: `当孩子的错因统计出现以下模式时，按此规则给建议：
- 进退位失误 ≥2 次：建议「进退位专项」关，语气鼓励（如「进位退位再练练，马上就更稳啦」）
- 看错符号 ≥2 次：提醒「做题前先看清 + 还是 −，不着急」
- 字词记忆 ≥2 次：建议先去错题本复习，再回来挑战
- 今日未打卡：招呼「今天还没打卡，来一关热热身吧」
- 全部答对/无错题：直接给推荐关加油（如「状态超好，试试新关卡吧」）
- 实在没信息：回复「沉默」`,
  })
}
