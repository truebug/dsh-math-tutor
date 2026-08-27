# 技术架构（coding 前基线）

> 核心判断：**DSH 没有改变「应用架构」，它改变的是「AI 能力架构」。**
> 外壳是传统 Web（静态前端 + 轻量后端 + nginx），内核是 DSH 插件生态（defineTool + LLM adapter + cordis 事件）。

## 分层架构

```
┌─────────────────────────────────────────────────┐
│ nginx（唯一对外入口，443/80）                      │
│  ├─ 静态站点 /dsh-math-tutor/  ← apps/web/dist    │
│  └─ 反代 /api/ → 127.0.0.1:8787                   │
├─────────────────────────────────────────────────┤
│ 应用层（传统 Web，自掌控）                          │
│  apps/web    React 纯静态产物（Vite build）        │
│  apps/server 原生 http，守护 API Key、转发 LLM      │
├─────────────────────────────────────────────────┤
│ AI 层（DSH 插件生态）                              │
│  packages/math-generator   确定性出题/判分          │
│  packages/grade-mapper     沪教版知识点映射         │
│  packages/progress-tracker 学习者画像（长期记忆）   │
│  packages/llm-openai-compatible（待建）多模型适配   │
├─────────────────────────────────────────────────┤
│ 存储层                                             │
│  浏览器 localStorage（MVP）→ 服务端 SQLite（单文件）│
└─────────────────────────────────────────────────┘
```

## 运行时现状（2026-08-27 后以此为准）

```
浏览器（React SPA）
  └─ /api/* → apps/server（裸 node:http，cordis 约定插件壳 host.ts）
       ├─ routes/（review/hint/battle/score/profile/weekly/sprite 七插件）
       ├─ services/agent.ts   Agent 网关 respond()：唯一 provider 出口
       │    ├─ kimi（默认）：services/llm.ts 直调 Kimi OpenAI 兼容端点
       │    └─ dsh（灰度）：services/dsh.ts → spawn dsh 子进程
       │         （stdio JSON-RPC，cordis.yml 见 dsh-runtime/，
       │          Kimi 经 dsh-llm-deepseek 适配器接入；familyId 会话锚点；
       │          session 持久化 /var/lib/dsh-tutor/sessions）
       ├─ services/learnerCtx.ts  画像摘要注入（agent 记得孩子）
       └─ data/  profiles/<familyId>.json + nicknames.json（昵称→UUID 索引）
```

灰度控制：`AGENT_PROVIDER` 环境变量全局切换，或 `?provider=dsh` 请求级灰度。
sprite 场景默认走 dsh，降级链 dsh→kimi→前端本地规则。

## 传统概念的取舍

| 传统概念 | 结论 | 说明 |
|---|---|---|
| 前后端 | 保留 | `apps/web` 静态 + `apps/server` 反代 |
| 数据库 | 简化 | MVP localStorage；服务端 SQLite，不上 MySQL/Postgres |
| 中间件 | 砍掉 | nginx 即全部；不要网关/ESB |
| 消息队列 | 砍掉 | 进程内事件用 cordis `ctx.on`；异步任务用 DSH `ctx.jobs` |
| 学生/家长 | 降级为 Learner | 核心是**学习者画像**；家长仅是「查看者」角色 |
| 教师/班级/教室 | 推迟 | 2B 场景概念；Learner 表预留可空 `class_id` 避免将来重构 |
| 科目 | 保留为字段 | `grade-mapper` 知识点表的 `subject` 字段 |
| 关卡/比赛/自动评估 | 玩法层实现 | 关卡 = 出题器参数预设；比赛 = 计时会话 + 确定性计分；评估 = 已有确定性判分。前端玩法模式，零架构改动 |

## 唯一真正的概念性重构

传统系统里「学生-班级-教师」是被 CRUD 的关系型核心表；本项目的核心资产是
**学习者画像（learner profile）**——agent 可读写的长期记忆，随练习持续演化，
最终注入 agent 上下文实现因材施教（见 docs/vision.md）。
形态上它更接近 DSH 的上下文/记忆机制，而不是一张静态表。

## 多 LLM 接入（DeepSeek / Kimi / GLM / MiniMax）

官方机制：`packages/llm` 的 adapter 体系（参考 `llm-deepseek`、`llm-pi-ai`），
手册：`../deepseek-harness/docs/cookbook/adding-an-llm-adapter.zh.md`。

方案：**自建一个通用 `llm-openai-compatible` 适配器**——Kimi、GLM、MiniMax
均提供 OpenAI 兼容端点，以 baseURL + apiKey + model 可配的方式一套代码覆盖多家；
DeepSeek 直接用官方 `llm-deepseek`。

规则：
- 注册：`ctx.llm.registerAdapter(['kimi' | 'glm' | 'minimax'], adapter)`，按 `options.provider` 路由。
- 密钥：schemastery Config + env 回退，经 `cordis.yml` 的 `!!js process.env.XXX_KEY` 注入；不读自定义密钥文件；key 不出服务端。
- 协议义务：finish 前发 usage、finish 后不再发内容；arguments 全程原始 JSON 字符串；不支持的能力抛 `LlmError(..., 'UNSUPPORTED')`，不静默丢弃；遵守 `options.signal`。
- 切换模型 = 改配置，业务代码零改动。

## 红线（与 docs/deployment.md 一致）

1. 出题/判分/统计永远确定性代码，LLM 只做讲解、归因、鼓励。
2. API Key 仅存服务端；`dsh web` 的 3080 端口仅本地调试，不对外开放。
3. 儿童数据最小化收集，画像默认本地存储，家长可见、可清除。

## Agent 部署形态与「积累-利用-迭代」闭环

### agent 在哪里运行？

DSH agent 运行在 **harness 所在进程**里：开发期是本机 `dsh web`，线上则部署在服务器上
（与 `apps/server` 同机，systemd 守护，不对外开放 3080）。也就是说：

- **agent 是服务端的**，孩子的浏览器只是 UI；画像与练习数据的持久化归属服务端（同意后）。
- agent 可以独立运行：DSH 以 Session 日志持久化 agent 状态，`agent.inject()` 追加的
  上下文跨会话保留——这构成 agent 侧的「长期记忆」。
- **定时能力的边界**：DSH 的 schedule 包是 **Session 内提醒**（持久于 Session 日志，
  Session live 时触发，冷 Session 恢复 live 后补做逾期工作），**不是外部守护定时器**。
  因此周期性的离线任务（如每晚汇总画像、生成周报）采用 **systemd timer / cron
  调用 server 内部 API** 实现；Session 活跃期间的轻量提醒用 DSH schedule。

### 闭环管线

```
浏览器（出题/判分/计时，确定性）
   │  练习结果（匿名摘要 or 授权后带 ID）
   ▼
apps/server  /api/*           ← LLM 调用唯一出口（key 不出服务端）
   │  写入画像（SQLite，需监护人同意；否则仅本次请求内存使用）
   ▼
Learner Profile（JSON 资产，厂商无关）
   │  ① 注入 LLM prompt → 个性化讲解
   │  ② agent.inject()  → DSH agent 长期上下文
   │  ③ 反哺出题参数    → 难度/进退位占比自适应
   ▼
迭代：错因聚类更新画像；推荐策略按采纳结果校准；systemd timer 定期生成成长报告
```

### 与传统 SaaS 的对照

传统做法是「用户表 + 推荐服务 CRUD」；本项目画像是 **agent 可读写的上下文资产**，
利用路径以 prompt/context 注入为主，而非在服务端跑独立推荐模型。
