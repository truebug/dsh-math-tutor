# dsh 升级评估与实施计划（2026-09-27，第二期例行评估）

> 对照 docs/dsh-adoption-report-20260923.md（上期）与 roadmap-agent.md（预验证清单）。
> 证据来源：npm registry 实查（09-27）、deepseek-harness master（fetch 至 09-27）、
> 现网 journalctl/systemctl 实查。

## 一、官方更新（相对 09-23 的变化）

### npm 版本线
| 标签 | 09-23 | 09-27 | 说明 |
|---|---|---|---|
| latest | 0.1.5-rc.2 | **0.1.5-rc.3**（09-22） | latest 推进一格，仍是 RC |
| next | 0.1.5-rc.2 | **0.1.7-rc.2**（09-24） | 0.1.7 线已进入 RC |
| alpha | 0.1.7-alpha.2 | 0.1.7-alpha.2 | 未变 |

- **关键判断点：仍无正式版**（latest/next 均为 rc）。升级触发信号未满足。
- 值得注意：0.1.7 已进入 RC 而 0.1.5 未出正式版——官方可能跳过 0.1.5 直接在
  0.1.7 线上收敛。届时迁移目标应以首个正式版为准，而非固守 0.1.5。

### 仓库动态（master 一周 391 commits）
与我们 SDK 嵌入面相关的 0.1.7 变化：
- `feat(user-questions): timed waits and late replies` —— 定时等待/迟到回复，
  与"小精灵主动提醒"场景潜在相关（未实测）
- `feat(llm): dynamic tool updates per route` + 多个 llm 修复 —— 工具路由增强，
  对 skill catalog 恢复路径是利好
- `fix(llm): oversized request extensions 不再阻塞模型请求` —— 长画像注入场景的
  稳定性修复，与我们直接相关
- SDK client/server 15 文件变动（+310/-86）——我们的 API 面极小
  （DeepSeekHarness + run + sessionId），风险低，但迁移时需重新冒烟
- skill 包族扩到 5 个子包（新增 skill-office、tool-workspace-dependencies），
  peer 自洽维持

## 二、现网部署现状（09-27 实查）

- `dsh-math-tutor` 服务 active，09-24 以来**零降级、零 ERROR**
- 会话锚点 17 个（jsonl 持久化正常）
- 版本：dsh-sdk-client/jsonrpc-server 等六包 @ 0.1.1-rc.2，cordis.yml 六插件组合
- LLM 链路：dsh 全量（hint/review/sprite/weekly）+ kimi 自动降级兜底
- 用户侧：无任何 dsh 相关投诉/异常

## 三、评估建议

**维持现网不动。理由未变且被新事实强化：**

1. 触发信号（latest 出正式版）未满足；0.1.5 线在 RC 停留 17 天（rc.1→rc.3），
   0.1.7 线又开始 RC——官方处于收敛前的高频打磨期，现在上车 = 替官方 beta 测试
2. 现网 13 天零降级，无任何由 dsh 版本引起的用户可见问题
3. 0.1.7 对我们有真实增量（user-questions 定时等待、llm 修复），
   但都是"锦上添花"，不构成冒 RC 风险的理由
4. 我们的三层切分保证切换成本恒定 ≈ 半天，等待无代价

**迁移目标版本策略修正**：原清单以 0.1.5 为锚；若 0.1.7 先于 0.1.5 出正式版，
直接以 0.1.7 正式版为目标（同一代码线后续，预验证结论大概率平移，
迁移前用既有 /tmp 冒烟脚本重跑一次确认即可）。

## 四、实施计划（触发信号满足后，总耗时 ≤1 天）

### 第 0 步：信号确认（每周一例行，30 秒）
`npm view @deepseek-ai/dsh dist-tags` —— latest 出现非 rc/alpha 版本即启动。

### 第 1 步：本地重冒烟（2h，Node 24）
- /tmp 隔离目录装正式版 dsh + sdk-client（复用 09-17 的 test3.mjs 脚本）
- 验证：profile 'sdk' 启动、DEEPSEEK_BASE_URL 覆盖 Kimi、persona patch、
  会话锚点复用、两轮延迟基线
- 任一失败 → 记录阻断点，回退等下一版

### 第 2 步：代码迁移（3h，按 roadmap-agent.md 清单）
1. `dsh-runtime/package.json` → 只留 `@deepseek-ai/dsh` + `dsh-sdk-client`（钉正式版号）
2. 删 cordis.yml，新增 `tutor.patch.yml`（thinking:disabled / k3 模型目录 / persona）
3. `services/dsh.ts`：`launch{command,args}` → `{profile:'sdk', patches, provider, model, env}`
4. systemd 加 `DSH_HOME=/var/lib/dsh-tutor`（会话目录随之迁移，旧锚点作废可接受——
   记忆锚点是优化项非数据资产）

### 第 3 步：灰度上线（2h）
- 服务器 dsh-runtime 目录整体替换（先备份）→ npm install → 重启
- 验证：sprite-advice provider=dsh 返回正常 + journalctl 零降级
- 回退预案：恢复备份目录 + systemctl restart（3 分钟）

### 第 4 步（可选二期，另行评估）：能力扩展
- tutor-skill 恢复为 skill catalog 真注册（llm 工具路由增强是 0.1.7 利好）
- goal round driver 多轮目标推进
- user-questions 定时等待 → 小精灵跨会话主动提醒（先最小实测）

## 五、风险登记
| 风险 | 等级 | 缓解 |
|---|---|---|
| 正式版 SDK API 再变 | 低 | API 面极小；第 1 步冒烟兜底 |
| 旧会话锚点丢失 | 低 | 锚点是体验优化非数据资产；丢失仅表现为小精灵"不记得"，下次对话重建 |
| 迁移当天 dsh 异常 | 低 | agent.ts 自动降级 kimi，用户无感；3 分钟回退预案 |
