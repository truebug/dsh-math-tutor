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

**第二步已部分落地（2026-08-27）**：hint 场景 dsh provider 线上跑通。
`POST /api/hint?provider=dsh` 走真 dsh 运行时（SDK client spawn 子进程，
session 持久化 /var/lib/dsh-tutor/sessions 已生效）；默认仍 kimi 直调。
灰度顺序不变：hint ✅ → review ✅ → sprite ✅（sprite-advice 默认走 dsh，agent 自主决策开口内容；kimi 降级 + 前端本地规则兜底）（`AGENT_PROVIDER=dsh` 全局切换或
`?provider=dsh` 请求级灰度）。上游每月 fetch 一次即可。

**第二步本地验证通过（2026-08-27）**：`tmp/dsh-local/`（gitignore）最小组合已跑通——
`dsh-jsonrpc-agent` spawn + cordis.yml（jsonrpc-server/agent-spine/llm-deepseek）+
`DeepSeekHarness.run()` 拿到 Kimi k3 真实回复。关键结论：

- ✅ **Kimi 适配成立**：`dsh-llm-deepseek` 的 `baseURL` 直指 `https://api.kimi.com/coding/v1`，
  `apiKeyEnv` 读 LLM_API_KEY，`models: [{id: k3}]` 即可，无需自写适配器
- ⚠️ **Node 需 ≥22.15**：`session-persistence-jsonl` 依赖 node:zlib zstd；
  本机 22.12 试跑时去掉持久化插件通过。服务器部署前确认/升级 Node
- ⚠️ cordis.yml 必填项：`agent-spine` 需 `workspaceContext.maxBytes`；
  stdout 纪律（不挂 stdout logger）
- 部署形态确认：server 按需 spawn 子进程（非常驻服务），stdin EOF 自动回收

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
  - ✅ 周报已落地并升级（2026-08-28）：结构化可打印报告——大数字周环比、7 天柱状图、
    分科对比表、亮点/重点关注、AI 寄语，`@media print` 适 A4（`components/GrowthReport.tsx`）

## 红线（沿用 README/vision）

- API Key 不出服务端；画像摘要不含身份信息；监护人明示同意才可上云
- 出题/判分永远确定性本地完成，LLM 只做讲解/鼓励/推荐
- 画像为纯 JSON 资产，与厂商/宿主无关，换框架不丢

## dsh 0.1.5-rc.2 升级预验证（2026-09-17，本地 Node 24 实测通过）

**结论：技术通道已打通，等正式版即可迁移。**

验证方法：/tmp 隔离目录装 `@deepseek-ai/dsh@0.1.5-rc.2` + `dsh-sdk-client@0.1.5-rc.2`，
真实 Kimi key 端到端跑 sprite 场景两轮会话。

**逐项结果**
- ✅ INACTIVE_EFFECT（0.1.2 阻断 bug）已修复：sdk profile 正常启动，无 patch 报错
- ✅ demo 包已废弃：`dsh-sdk-jsonrpc-demo`/`dsh-agent-spine-demo` 不在 0.1.5 线；
  新启动方式 = dsh CLI + `profile: 'sdk'` + `--patch` 叠加层（cordis.yml 不再需要，
  base profile 自带 llm/session/持久化/工具/凭证全套）
- ✅ Kimi 接入零 patch：`DEEPSEEK_BASE_URL` env 覆盖 baseURL（env 优先级最高），
  `DEEPSEEK_API_KEY` 传 key；`thinking: disabled` + k3 模型目录走 patch（按 id 合并）
- ✅ persona 可配：`system-prompt` 插件的 personaPrefix/personaSuffix 进 patch
  （实测「小精灵」人格生效，输出带"小精灵说"前缀）
- ✅ 会话锚点：同 sessionId 第二轮记得上下文；jsonl 落盘 `$DSH_HOME/sessions/`
- ✅ skill/goal 能力线齐了：dsh-skill、dsh-skill-filesystem、dsh-goal、
  dsh-goal-round-driver、dsh-tool-goal 全在 0.1.5 依赖树内，peer 自洽——
  升级后 tutor-skill 可恢复为真正的 skill catalog 注册（当前为 prompt 内联）
- ✅ 延迟：冷启动首轮 ~16s（模型调用占大头），同会话第二轮 ~6.6s

**迁移清单（正式版发布后，预估半天）**
1. `dsh-runtime/package.json` → 只留 `@deepseek-ai/dsh` + `dsh-sdk-client`（版本钉正式版）
2. 删 `cordis.yml`；新增 `tutor.patch.yml`（llm-deepseek: thinking/models；system-prompt: persona）
3. `services/dsh.ts` 改造：`launch{command,args}` → `{profile:'sdk', patches, provider, model, env}`；
   env 注入 `DEEPSEEK_API_KEY/DEEPSEEK_BASE_URL/DSH_HOME`，PATH 前置 node22 目录
4. 服务器 systemd 加 `DSH_HOME=/var/lib/dsh-tutor`；会话目录随 DSH_HOME 迁移
5. （可选）tutor-skill.ts 恢复为 skill 插件挂载 dsh-skill-filesystem

**升级触发信号（维持）**：npm latest 出现 0.1.5 正式版（非 rc/alpha）。
