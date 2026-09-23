# dsh 深度使用可行性/必要性评估报告（2026-09-23）

> 触发：用户要求基于 dsh 线上最新现状，评估深入使用的可行性与必要性。

## 一、dsh 线上现状（事实层）

### 版本线（npm 实查）
| 标签 | 版本 | 发布 |
|---|---|---|
| latest | 0.1.5-rc.2 | 09-10 |
| next | 0.1.5-rc.3 | 09-22（昨天） |
| alpha | 0.1.7-alpha.2 | 09-22（昨天） |

- 0.1.5 线仍是 RC（rc.3 昨天刚发），**无正式版**；官方节奏约 3-7 天一版，推进很快
- 0.1.6→0.1.7-alpha 间的仓库更新（1328 commits / 一周）几乎全是 Web UI / desktop /
  chat 滚动 / 插件管理器镜像选择等**面向终端产品**的打磨，无面向 SDK 嵌入方的新能力线

### 与我们相关的关键事实
- 0.1.2 的 INACTIVE_EFFECT 阻断 bug 已修复（本地实测，roadmap-agent.md 预验证记录）
- demo 包（jsonrpc-demo / agent-spine-demo）已废弃，新形态 = dsh CLI + profile + patch
- skill/goal/persona/webhook 能力线在 0.1.5 依赖树内齐全且 peer 自洽

## 二、我们当前 dsh 使用现状（代码实查）

- `agent.ts`：三层切分的唯一替换点，provider 可配，dsh 失败自动降级 kimi
- 服务器 `AGENT_PROVIDER=dsh`，**hint/review/sprite/weekly 四场景全量走 dsh**
- `dsh.ts`：SDK client spawn 子进程 + 会话锚点（familyId→sessionId），崩溃重孵
- 线上实测（09-23）：服务 active，09-14 以来**零降级**，会话目录正常（19 个子目录）
- 我们用到的 dsh 能力：LLM 会话 + 会话记忆锚点 + jsonl 持久化 + cordis 插件壳
- **未使用**：skill catalog / goal round driver / 工具调用 / 子代理 / 审批流 / ACP

## 三、可行性评估：深入使用的三条候选路径

### 路径 A：升级 0.1.5（换形态）——可行性已证，必要性低
- 迁移清单已备（roadmap-agent.md），预估半天，本地预验证通过
- 收益：启动方式更简洁（删 cordis.yml）；skill catalog 可恢复真注册；官方维护的
  组合比我们手写的 6 插件 cordis.yml 更全（自带重试/凭证/附件等）
- 风险：rc 线仍有破坏性变更可能；每版追赶成本高（官方 3-7 天一发）
- **判断：等 0.1.5 正式版。rc 阶段不动现网是对的。**

### 路径 B：在当前 0.1.1 上"用更多 dsh 能力"——不可行
- skill catalog 在 0.1.1 不存在（peer 冲突，9/13 已实测）；goal/persona/webhook 同理
- 0.1.1 上我们能榨的能力已榨干

### 路径 C：等正式版后按"用满 0.1.5"设计——值得做，且是深度使用的正解
升级不是目的，**用 upgrade 后的新能力解决真实痛点**才是。候选（按价值排序）：
1. **skill catalog 恢复**：错因建议规则从 prompt 内联回到真正的 skill 注册，
   多规则包并存时 agent 自主选用（当前只有一套规则，紧迫性低，但架构更对）
2. **goal round driver**：周目标从"进度提醒"升级为 agent 多轮主动推进
   （"今天离目标还差3题，来一关？"跨会话持续跟踪）——这是 0.1.1 手写做不到的
3. **webhook/事件**：练习完成事件 → 服务端触发 agent 复盘，替代当前轮询/前端触发
4. **子代理**：家长周报的多维度汇总（读画像+算趋势+写寄语）可并行子任务

## 四、必要性评估（直说）

**当前不必要立刻深入。** 理由：
1. 四场景 LLM 表达层已稳定运行 9 天零降级，无投诉无瓶颈
2. 唯一可量化的缺口是"目标的多轮推进感"，但它排在高年级题库（用户可见价值）
   之后，而高年级题库不依赖 dsh 版本
3. 官方仍处 RC 高频变更期，现在深度绑定 = 替官方 beta 测试，成本我们扛
4. 我们的三层切分（agent.ts 唯一替换点）保证了任何时刻切换成本 ≈ 半天

**但升级准备是必要的**——预验证已完成、清单已备，信号明确（latest 出现
0.1.5 正式版），届时一周内可完成"升级 + skill 恢复 + goal 多轮化"三件套。

## 五、结论与建议行动

- **现在**：不动。现网 0.1.1 稳定；把精力放回高年级题库（用户价值主线）
- **监控**：每周一查 `npm view @deepseek-ai/dsh dist-tags`；latest 变 0.1.5
  （非 rc/alpha）即启动迁移
- **迁移时**（半天）：dsh + sdk-client 两包 → tutor.patch.yml → dsh.ts 改 profile
  启动 → systemd 加 DSH_HOME → 顺手恢复 tutor-skill 真注册
- **迁移后**（可选二期）：goal round driver 多轮目标推进，sprite 主动性再上一个台阶

## 附：本报告证据来源
- npm registry dist-tags/time（2026-09-23 实查）
- github.com/deepseek-ai/deepseek-harness master（fetch 至 2026-09-22，1328 commits/周）
- 现网 journalctl（09-14 起零降级）+ 会话目录（19 会话锚点目录）
- 代码：agent.ts / dsh.ts / sprite.ts 实读
