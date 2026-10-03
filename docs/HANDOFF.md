# 项目交接文档（2026-10-02）

> 给下一个接手的 agent：读完这份文档即可无缝继续。所有内容基于代码与线上实查，无推测。
> 补充阅读：`docs/progress.md`（交付流水账）、`docs/roadmap-agent.md`（agent 化路线）、
> `docs/vision.md`（产品愿景）、`docs/architecture.md`（架构）。

## 一、项目是什么

小学（二年级为主）语/数/英练习 Web 应用「知识大陆」：
寻宝地图式关卡 + AI 小精灵（dsh 运行时驱动）+ 家长看板 + 排行榜/勋章/周目标。
- 仓库：https://github.com/truebug/dsh-math-tutor（**公开仓库**）
- 本地路径：`/Users/bug/Downloads/projects/dsh-math-tutor`
- 前端 `apps/web`（React 19 + Vite 7），后端 `apps/server`（裸 node:http + cordis 约定插件壳）

## 二、部署（线上实查 10-01 健康）

- 线上地址：`https://120.27.200.203:2008/dsh-math-tutor/`（09-30 起启用 HTTPS，自签名 IP 证书，
  首次访问浏览器有警告属预期；旧 HTTP 链接 302 自动跳转）
- 服务器：coolje00（120.27.200.203），nginx 2008 端口，systemd 守护 `dsh-math-tutor`
- 后端：`/opt/dsh-math-tutor/server/`（src + .env + dsh-runtime/）
- dsh 会话锚点：`/var/lib/dsh-tutor/sessions/`（DSH_HOME 由 systemd Environment= 注入，
  **不能放 .env**，dsh 0.1.5 会拒绝启动环境变量从 env 文件读取）
- 数据：`server/data/`（profiles/ 云端画像、nicknames.json 昵称索引、visits.jsonl 访客、
  chat-metrics.jsonl 语音埋点）——**均在 .gitignore，不入库**
- Node：服务器 `/opt/node22/bin/node` v22.19（dsh 持久化需 ≥22.15）；
  本机 `/Users/bug/.nvm/versions/node/v24.21.0/bin/node`（验证用）

### 部署流程（重要：前后端分开 scp，曾发生误覆盖事故）
```bash
# 前端（仓库根目录）
cd apps/web && VITE_BASE_PATH=/dsh-math-tutor/ pnpm build
scp -r dist coolje00:/tmp/dsh-web
ssh coolje00 "rm -rf /var/www/html/dsh-math-tutor && mv /tmp/dsh-web /var/www/html/dsh-math-tutor"
# 后端（仅 src 变更）
scp -r apps/server/src coolje00:/tmp/dsh-server-src
ssh coolje00 "cp -r /tmp/dsh-server-src/* /opt/dsh-math-tutor/server/src/ && rm -rf /tmp/dsh-server-src && systemctl restart dsh-math-tutor"
# dsh-runtime 依赖变更（很少）
scp apps/server/dsh-runtime/{package.json,tutor.patch.yml} coolje00:/tmp/
ssh coolje00 "export PATH=/opt/node22/bin:\$PATH; cd /opt/dsh-math-tutor/server/dsh-runtime && npm install --omit=dev && systemctl restart dsh-math-tutor"
```
验证：`curl -sk https://127.0.0.1:8787/api/health`（服务器内）→ `{"ok":true}`

**部署纪律（防多 agent 部署竞态，2026-10-03 起）**：
1. 部署前 `git status` 必须干净（含未提交改动的构建不可上线上）
2. 只允许部署 git HEAD 的构建产物；部署后在 `docs/progress.md` 记一行（commit hash + 时间）
3. 前端 build 会自动 `prebuild` 同步逃生游戏源文件（demo/ → public/），不要手工 cp

## 三、dsh 集成现状（本项目的核心特色）

- **版本**：0.1.5-rc.3（09-27 从 0.1.1-rc.2 升级，进入小步跟踪模式：新 RC/正式版 → 冒烟 → 小步升级）
- **架构**：三层切分——`services/agent.ts`（35 行唯一替换点，provider 可配 dsh/kimi，dsh 失败自动降级 kimi）+
  `services/dsh.ts`（98 行适配层）+ `dsh-runtime/`（独立目录、独立依赖）
- **启动方式**：dsh CLI + `profile: 'sdk'` + `dsh-runtime/tutor.patch.yml` 叠加层
  （cordis.yml 已在 0.1.5 废弃；patch 内容：llm-deepseek thinking:disabled + k3 模型目录 +
  system-prompt 小精灵人格 + web-search-deepseek 用独立 env）
- **LLM 链路**：对话 100% Kimi（`LLM_BASE_URL=https://api.kimi.com/coding/v1`，模型 k3），
  经 `DEEPSEEK_API_KEY`/`DEEPSEEK_BASE_URL` env 注入 dsh 子进程——**没有 DeepSeek 对话 API 混进来**
- **web 搜索**：DeepSeek 官方搜索端点，用独立 env `DEEPSEEK_SEARCH_API_KEY`（从 zhidong2
  `/etc/daily-brief.env` 直传，与 Kimi key 隔离）
- **五场景全量走 dsh**：hint（讲解）/review（点评）/sprite（今日建议）/chat（语音对话）/weekly（周报），
  均有 kimi 降级兜底；会话锚点 familyId→sessionId（小精灵记得孩子）
- **切换方式**：代码默认 provider 是 kimi，线上由服务器 `.env` 设 `AGENT_PROVIDER=dsh` 切全量——
  .env 不入库，仓库里看不到这个开关，新环境部署时别漏配
- **线上健康**：09-28 起零降级零报错（journalctl 实查），会话锚点 9 个

### 历史踩坑（勿重蹈）
1. 0.1.2-rc.1 有 INACTIVE_EFFECT bug（sdk profile 无法启动）——0.1.5 已修复
2. 0.1.1 的 `@deepseek-ai/dsh-skill` 永不加载（0.1.2 才发布且 peer 冲突）——
   建议规则已内联进 sprite.ts 的 SYSTEM；**skill catalog 真注册要等 0.2.0 正式版**
3. DSH_HOME 是"启动环境变量"，0.1.5 拒绝从 .env 读取——必须 systemd `Environment=` 注入
4. 部署事故：前端 src 曾误覆盖后端——前后端必须分目录 scp
5. 公开仓库脱敏（09-30 commit 785b301）：IP/主机别名/部署细节已清出 HEAD；
   git 历史残留属用户容忍的低危；`docs/deployment.md` 已 `git rm --cached` 移出索引（本地保留，
   .gitignore 兜底防重新入库）

## 四、功能现状（全部已上线）

- 寻宝地图四大陆：数学/语文/英语（二年级，各 16 关）+ 游乐场（13 关 7 玩法：
  单词消消乐/古诗词接龙/数字贪吃蛇/打地鼠/翻牌记忆/逃离切尔诺贝利(escape,10-03)/
  核电站主控实践(reactor,10-03，与 escape 组成叙事二部曲，纯前端确定性物理模型零 LLM)）
- 闯关页视口适配、首屏 shader 背景、按钮微交互、返回首页按钮
- 每日挑战（多科目轮换）、错题本+重练（热力图）、积分/排行榜（掩码昵称）/勋章墙/周目标
- 家长看板：成长报告（可打印 A4）、14 天指标趋势图、画像错因分析
- 小精灵主动性：地图页今日建议气泡（画像驱动）、练习中连续秒错干预
- 账号：昵称绑定+PIN 换设备恢复、监护人同意卡片
- 匿名访客画像：/api/visit（UUID+日期+是否建档，无 IP/UA），看板访客卡片
- **语音对话（09-30 上线）**：VoiceChat 组件（🎤 长按说话→浏览器识别→chat 场景→TTS 朗读），
  术语纠错映射（"正推卫"→"进退位"等）；语音埋点 chat-metrics.jsonl（voice/text 计数）

### 已知遗留（勿修，非本次范围）
- 前端 tsc 剩 5 个历史遗留报错（10-03 另一 agent 顺手修掉 10 个）：
  App.tsx newBadges×2、AdventureMap/MapView max 重复指定、ResultView Subject 收窄。
  不影响构建运行（vite build 通过），修复需动组件契约属独立小工程

## 五、未尽事宜（按优先级）

1. **语音对话真实数据验证**（等用户实测反馈）：HTTPS 刚通，等孩子真实使用。
   chat-metrics.jsonl 一周后看 voice/text 比例 → 决定 Pipecat 级投入是否值得
   （Pipecat 归档：docs/ref/pipecat-voice-agent-20260929.md）
2. **高年级题库 G3/4/5（最大用户价值缺口）**：
   - 英语：二年级词库已换上教社 2024 新版（用户拍照提供，docs/ref/english_g2.*.jpg），
     三/四/五年级词表仍缺——**等用户拍照**（联网检索噪音过大不可靠）
   - 语文/数学：沪教版五年制高年级知识点清单 agent 可先拟，用户对照实体课本核
   - 首页建档的 3/4/5 年级 disabled、智慧树快捷通道灰色态均已就位，题库到即可点亮
3. **dsh 0.2.0 跟踪**（每周一查 `npm view @deepseek-ai/dsh dist-tags`）：
   latest 已 0.2.0-rc.2（09-29），正式版出即迁移（清单在 roadmap-agent.md，预估半天，
   可顺手恢复 tutor-skill 真注册 + 启用 goal round driver 多轮目标推进）
4. **推荐规则月度 review**：指标趋势图已上线，每月看一次采纳率/命中率
5. **数学几何题（暂缓）**：面积/周长需 SVG 图形渲染，独立小工程
6. **游乐场新玩法 backlog**：docs/arcade-games.md 有 12 个候选按成本/价值排序

## 六、与用户协作的约定（血泪教训）

- **中文交流，节奏快**："go/继续/ok"即干活，不要说一句动一下，持续执行到有结果再停
- **每次改动后**：构建 → 部署 → 线上验证（journalctl 零降级）→ commit → push → 告知 commit hash
- **铁则**：不用 node_repl/持久 REPL 工具（曾触发 tool-call-id 重复卡死会话）；验证用一次性命令
- **公开仓库红线**：密钥/用户数据绝不入库（.env、server/data/ 已 gitignore）；IP/主机别名/部署路径
  不入业务代码与常规文档，**仅允许出现在 docs/HANDOFF.md（交接必需）与本地保留的 docs/deployment.md**；
  提交前自查 `git status` + 敏感词扫描
- **出题判分永远确定性本地**，LLM 只做讲解/鼓励/推荐；API key 不出服务端；监护人同意才上云
- **报告类产出**写 docs/ 并推送；技术方案先给计划再动手
- ssh 服务器别名：coolje00（本项目部署机）、zhidong2（key 来源）；scp/ssh/curl 已批准

## 七、关键文件地图

| 文件 | 作用 |
|---|---|
| `apps/server/src/services/agent.ts` | agent 网关（唯一替换点，五场景：review/hint/weekly/sprite/chat） |
| `apps/server/src/services/dsh.ts` | dsh 适配层（profile/patch 启动、env 注入、崩溃重孵、健康检查） |
| `apps/server/dsh-runtime/` | dsh 运行时（package.json 两包 + tutor.patch.yml，cordis.yml 已删） |
| `apps/server/src/routes/*.ts` | 9 个业务路由（含 visit 访客、chat 语音） |
| `apps/web/src/components/VoiceChat.tsx` | 语音对话组件（识别+TTS+术语降级） |
| `apps/web/src/lib/visit.ts` | 访客 UUID 上报 |
| `apps/web/src/components/ReactorView.tsx` + `lib/reactorPhysics.ts` | 核电站主控实践（物理纯函数+5任务+熔毁特效） |
| `apps/web/src/components/EscapeView.tsx` + `demo/chernobyl-escape/index.html` | 逃离切尔诺贝利（demo/ 为唯一源，prebuild 自动同步到 public/escape/） |
| `apps/web/scripts/reactor-smoke.mjs` | 反应堆 5 场景回归冒烟 |
| `docs/progress.md` | 交付流水账（倒序，含线上状态） |
| `docs/roadmap-agent.md` | agent 化路线 + dsh 迁移清单 + 语音助手方向 |
| `docs/dsh-adoption-report-*.md` | 两期 dsh 评估报告 |
| `docs/ref/` | 教材照片、Pipecat 归档、生态评估、打印产物 |
