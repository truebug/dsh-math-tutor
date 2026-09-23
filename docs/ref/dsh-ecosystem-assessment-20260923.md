# dsh 生态现状评估（外部提供，2026-09-23 经我方核实）

## 已核实属实的事实
- GitHub **233,831 stars**（API 实查），2026-08-13 创建，MIT，持续高频提交
- npm `@deepseek-ai/dsh` 6 周 25 个版本，latest 0.1.5-rc.2（2026-09-23 实查）
- "Everything is a Plugin"：cordis 插件树 + profile/bundle 分层
  （web / headless / sdk / sdk-minimal / acp 五种形态）
- 官方包规模：本地仓库 55 个顶层包目录

## 关键包价值对照（含我方更正）
| 包 | 原评估 | 我方核实 |
|---|---|---|
| llm-pi-ai | 多 provider 路由，Kimi 可零代码接入 | **更正**：单 provider 不需要它。`llm-deepseek` 适配器原生支持 `DEEPSEEK_BASE_URL` env 覆盖，Kimi（OpenAI 兼容端点）零代码接入；llm-pi-ai 留给多 provider 路由场景 |
| schedule | 持久化提醒 | 包存在，行为未实测；启用前做最小验证 |
| workflow/subagent/skill | 流水线编排 | skill 线已在 0.1.5 依赖树确认可用；其余未实测 |
| sandbox/guard | 安全边界 | 包存在，儿童场景策略表达力未实测 |
| credentials | 密钥管理 | 我们当前用 env 注入已满足，credentials 属增强项 |
| jobs/webhook | 异步/事件 | webhook 细节仅扫 commit 标题，未实测 |
| Python SDK | wheel 打包 dsh CLI | 存在；我们 server 是 TS 栈，暂不需要 |

## 我方使用边界声明
- 已实测走通：SDK client → profile 'sdk' → patch → Kimi → 会话锚点 → jsonl 持久化
- 55 包中实际使用 6 个；未实测的包不做结论，启用前一律最小实测先行
- 三层切分（agent.ts）保证切换成本 ≈ 半天，无锁定风险
