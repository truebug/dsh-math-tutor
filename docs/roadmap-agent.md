# Agent 化改进计划（2026-08 反思与路线）

> 背景：对照 docs/vision.md 的初心——「AI agent 与孩子共同成长」，当前实现
> 只用了 LLM 做"事后点评"，DeepSeek Harness 的 agent 能力（插件/工具/记忆注入）
> 尚未进入运行时。本计划把差距收敛为可执行的四个阶段。

> 状态（2026-08-26）：P0/P1/P2/P3 已全部落地（见 docs/progress.md 2026-08-25）。
> DSH 真 Runtime 接入评估后暂缓——cordis 约定宿主（host.ts）已满足当前需求，
> 真接 dsh 只值服务层，待需要跨会话记忆/多 agent 编排时再启。

## 接入预备（2026-08-27 三层契约，纯重构行为不变）

经复盘修正：上游 dsh 是否破坏性变更不构成拒绝接入的理由——只要三层切分做好，
换 dsh / 换 openclaw / 换任何 agent 框架都只是改一个 provider 实现。当前契约：

| 层 | 现状 | 接 agent 时 |
|---|---|---|
| 感知/记忆 | `profile.ts` 画像 JSON（前端）+ `services/learnerCtx.ts` 服务端摘要 | 不动，作为 agent 工具的 read 面 |
| 决策/表达 | `lib/sprite.ts`（前端规则入口）+ `services/agent.ts` respond()（唯一 provider 出口） | **唯一替换点**：spriteAdvice 内部改调 agent；respond() 增 dsh provider |
| 呈现 | `Sprite` 气泡 / 结算页点评卡 | 不动，内容来源换了 UI 零感知 |

**迁移映射（届时照表施工，预计 2-3 天）**

- `lib/sprite.ts spriteAdvice()` 规则集 → agent 系统提示词 + 画像工具
- `services/learnerCtx.ts buildLearnerContext()` → `ctx.tools.register('get-learner-context')`
- `services/agent.ts respond()` → 增 `AGENT_PROVIDER=dsh` 分支（SDK client → 独立运行时）
- 错题查询/积分提交（routes/battle.ts、routes/score.ts 内的纯函数）→ 对应 agent 工具
- 灰度顺序：hint → review → sprite（逐场景切流量，AGENT_PROVIDER 环境变量控制）

**接入触发信号**（任一即启动第二步）

1. dsh 发布 0.2/稳定版（当前 0.1.1-rc.2，2026-08-21 后上游无新提交）
2. 需要跨会话记忆 / 多 agent 编排 / 官方工具链（MCP、skills）
3. 服务器有资源跑独立 dsh 运行时进程（coolje00 资源够，主要差部署与监控）

**第二步预检（2026-08-27）**：上游 master 仍停在 `b150a551b8`（2026-08-21，
0.1.1-rc.2），三个触发信号均未出现，第二步继续待命。每月 fetch 一次上游即可。

## 主动性补全（2026-08-27）

- 练习后复盘邀请：结算页错题列表上方小精灵气泡 CTA（🧚 趁热打铁 → 错题本）
- 勋章系统：`lib/badges.ts` 14 枚（集星/满星/连击打卡/累计答题/错题重练五线），
  确定性判定零 LLM；结算页新勋章弹窗 + 看板勋章墙（已获得点亮/未获得灰显进度）
- 推荐规则月度 review 闭环：`scripts/recommend-review.mjs`（画像 JSON 进，
  采纳率/命中率阈值告警出，人工+AI 联合 review 清单）

## 差距清单（现状 → 目标）

1. **DSH 运行时零接入** → server 接入 `@deepseek-ai/dsh`，把 review/hint 从裸 fetch 改造为 dsh 插件（defineTool + ctx.tools.register），cordis.yml 启用
2. **画像未注入 agent 上下文** → 每次 LLM 会话经 `agent.inject()` 携带该孩子的持久画像（掌握度/错因趋势/节奏偏好），实现"agent 记得这个孩子"
3. **小精灵被动 → 主动** → 从"答错后点按钮"升级为：练习前画像驱动的今日建议、练习中实时节奏干预（连续秒错时提醒"慢一点"）、练习后主动复盘邀请
4. **推荐规则写死 → 持续校准** → 推荐采纳率/错因命中率落库（vision.md 既定指标），每月人工+AI 联合 review 规则有效性
5. **画像出口不齐** → 难度推荐从单点（carryRatio）扩展到题量/题型配比/科目侧重；画像摘要进入每日挑战选题
6. **家长端 agent 化** → 看板加"本周成长简报"（LLM 基于一周画像生成，语音可读），替代家长自己读图

## 阶段划分

- **P0（1-2 天）**：server 迁移到 dsh 插件架构（review/hint/score 三路由改造），cordis.yml 本地调试可用。纯重构，行为不变
- **P1（2-3 天）**：画像注入 `agent.inject()`，点评/讲解/推荐全部走画像上下文；小精灵练习前今日建议（画像驱动文案）
- **P2（3-5 天）**：主动性——练习中节奏干预（连续秒错/长考提示）、练习后主动复盘；难度推荐扩到题量与题型配比
- **P3（1 周）**：家长周报（LLM 生成+语音朗读）、推荐采纳率/错因命中率指标落库与看板展示

## 红线（沿用 README/vision）

- API Key 不出服务端；画像摘要不含身份信息；监护人明示同意才可上云
- 出题/判分永远确定性本地完成，LLM 只做讲解/鼓励/推荐
- 画像为纯 JSON 资产，与厂商/宿主无关，换框架不丢
