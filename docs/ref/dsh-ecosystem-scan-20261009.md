# dsh 生态扫描（2026-10-09）

> 数据源：npm registry / api.npmjs.org 下载量 API，经本地代理实查。
> 背景：HANDOFF 既定「每周一查 dist-tags，正式版出即迁移 0.2.0」；本次顺带评估插件生态可应用性。

## 一、版本动态

- dist-tags：`latest = next = 0.2.0-rc.2`（09-29 起未动）；`alpha = 0.2.1-alpha.1`（10-03）
- **0.2.0 正式版仍未发布**——维持小步跟踪，现网 0.1.5-rc.3 不动
- 节奏：9 月高频（0.1.5→0.1.6→0.1.7→0.2.0-rc 四周四线），10 月已进入 0.2.1 alpha，正式版临近
- `@deepseek-ai/dsh` 近月下载 188 万，sdk-client（我们的嵌入路径）24.7 万（≈13%）

## 二、0.2.0-rc.2 相对 0.1.5-rc.3 的依赖变更

- 新增：dsh-plugin-manager、dsh-mcp-resources、dsh-workflow-ptc、dsh-skill-office、
  dsh-agent-preset、dsh-hmr、dsh-atomic-write、dsh-tool-workspace-dependencies、
  实验线×4（voice-input-bundle、agent-team-profile、auto-review、schedule-bundle）
- 移除：cordis-plugin-hmr、dsh-workflow-worker-thread

## 三、插件热度排行（近月下载量）

> 绝大多数插件是 dsh 主包的默认依赖，下载量≈主包装机量，代表「官方默认装载」而非独立采用率。

| 梯队 | 包 | 月下载 | 含义 |
|---|---|---|---|
| 核心默认 | dsh-skill / dsh-llm-deepseek / dsh-goal / dsh-token-meter / dsh-skill-filesystem | 185-199 万 | 随主包装机，skill/goal 线已是事实标配 |
| 工具默认 | tool-bash/fs/web/jobs/goal/skill/ralph、mcp-client、plan-mode、persona、terminal、schedule、headless | 175-182 万 | 同上 |
| 应用壳 | web-app / acp-app / sdk-app / sdk-minimal / webhook | 161-177 万 | 同上 |
| 0.2.0 新增（RC 用户） | workflow-ptc / mcp-resources / plugin-manager / agent-team-profile / skill-office / voice-input-bundle / auto-review | 40-52 万 | RC 采用规模约为主包 1/4 |

## 四、对本项目的可应用性评估

**直接可用（随 0.2.0 迁移一并启用）**
- `dsh-skill` + `dsh-skill-filesystem`：恢复 tutor-skill 真注册（当前建议规则内联在 sprite.ts 的 SYSTEM，
  迁后改为 skill catalog，规则可热维护）
- `dsh-goal` + `dsh-tool-goal` + `dsh-command-goal`：goal round driver 多轮目标推进，
  周目标（「冲 85%」）可从 prompt 提示升级为 agent 自主追踪
- `dsh-token-meter`（ctx.token-meter，回放感知的 token 计量）：
  **10-06 降级根因是 Kimi 周配额 403 撞墙才被发现**——迁后可用它做用量可视/提前预警，值得优先验证

**观察名单（方向相关，暂不动）**
- `dsh-experimental-voice-input-bundle`：本地 SenseVoice 语音输入（首次使用下载运行时）。
  与语音助手方向同赛道，但它是面向 dsh CLI 的输入增强，我们是浏览器场景且 Web Speech API 已够用；
  若未来做 Pipecat 级方案可对比其 SenseVoice 儿童语音识别效果。experimental 标，等稳定
- `dsh-schedule` + `dsh-jobs-local`：持久化定时/提醒。可用于周报定时生成、小精灵主动提醒
  （当前周报是家长触发）。等 0.2.0 稳定后评估
- `dsh-plugin-manager`：profile 插件动态管理（CLI/Web/agent 共用）。运维向，迁后自然获得

**不适用**
- `dsh-experimental-agent-team-profile`（多 agent 团队）：儿童家教场景单精灵人格足够
- `dsh-experimental-auto-review`（Auto 权限 preset 的逐工具 LLM 审批）：面向编码 agent 权限，我们用 sdk profile
- `dsh-workflow-ptc` / `dsh-acp-app` / `dsh-web-app` / `dsh-webhook` / `dsh-mcp-resources`：
  工作流编排/ACP 协议/dsh 自有 Web 壳/入站 webhook/MCP 资源——当前架构（五场景请求响应式）均不需要

## 五、结论

1. 维持既定策略：**等 0.2.0 正式版**，rc.2 与 0.1.5-rc.3 差距不构成提前迁移理由
2. 迁移清单（roadmap-agent.md）追加两项验证：`dsh-token-meter` 用量预警接入、`dsh-goal` round driver 试点
3. 语音方向继续以「chat-metrics 真实数据」为决策门槛，voice-input-bundle 仅作技术储备
4. 下次例行检查：2026-10-12（周一）
