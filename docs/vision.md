# 愿景：AI agent 与孩子共同成长

> 「因材施教，各走各路」——不是千人一面的枯燥灌输，而是 agent 在陪伴中理解每一个孩子。

## 为什么选 DeepSeek Harness

DSH「一切皆插件」的 Cordis 架构天然适合长期演化：能力以插件叠加，agent 的上下文、记忆与工具可以随孩子年级增长持续升级，而不必推翻重来。我们选择的不是一次性交付的练习软件，而是一个**能和孩子一起长大的 agent 宿主**。

## 核心闭环：积累 → 利用 → 迭代

画像不会因为「接了 AI」自动产生——它必须被显式设计。本项目的生命线：

```
积累（Capture）          利用（Apply）               迭代（Evolve）
每次练习 → 结构化沉淀  →  注入 agent 上下文     →  agent 表现被观察
  · 出题/判分本地完成       · 点评请求携带画像摘要      · 推荐采纳率、错因命中率
  · 错题、耗时、进退位       · 难度推荐由画像驱动       · 画像随每次练习自动更新
  · 存 localStorage/SQLite   · 讲解措辞贴合年龄性别      · 跨学科迁移（数→语→英）
        └────────────── 同一孩子，越用越懂 ──────────────┘
```

### 积累：学习者画像 Schema

```ts
interface LearnerProfile {
  identity: { nickname, grade, age, gender, subjects[] }   // 首次「我是谁」采集
  mastery:  Record<KnowledgePointId, { acc, avgMs, attempts, lastAt }>  // 知识点掌握度
  errorPatterns: Array<{ kind, count, example }>           // 错因聚类：进位遗漏/看错符号/…
  pace:    { perQuestionMsTrend: number[] }                // 速度趋势
  prefs:   { encourageStyle, sessionLength }               // 从行为推断的偏好
}
```

### 利用：画像的三条出口

1. **难度推荐**：`grade-mapper` + `math-generator` 用 mastery 自动调 level 与题量（画像驱动参数，而非固定档位）。
2. **个性化讲解**：server 调 LLM 时携带画像摘要（不含身份信息），生成贴合该孩子的错题讲解与鼓励。
3. **agent 上下文**：接入 DSH agent 后，同一画像经 `agent.inject()` 注入持久化上下文，agent 每次对话都「记得」这个孩子。

### 迭代：agent 能力随数据升级

- 每周/每次练习后，画像自动增量更新（确定性代码，不走 LLM）。
- 错因聚类反哺出题器：错「进位加」多 → 下一组题提高进位占比（自适应雏形）。
- agent 推荐策略（给多少题、什么难度）依据采纳结果持续校准。

## 数据主权与同意

- 默认全部本地（localStorage），AI 点评走匿名单次请求（只发本次错题摘要）。
- 「开启云端同步」需**监护人明示同意**（符合《儿童个人信息网络保护规定》），同意后画像存服务端 SQLite，家长随时可查看、导出、清除。
- 画像**与厂商无关、与宿主无关**：纯 JSON 资产，换 LLM 或换 agent 框架都不丢。

## 演化路径

```
阶段 A：既有范式（已交付）      固定知识点 → 确定性出题 → 判分/计时/错题本
阶段 B：数据积累（进行中）      练习记录 → 结构化画像（本地）→ 同意后可上云
阶段 C：个性化匹配              画像驱动难度/重点/讲解；AI 点评进场
阶段 D：共同进化                跨学科扩展；agent 推荐策略持续校准
```
