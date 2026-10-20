# P0 加固实施计划（2026-10-20）

> 范围：只覆盖上一轮评审的 6 项 P0：工具面收口、降权隔离、鉴权限流、记忆闭环、可靠性/多供应商、语音隐私。
> 原则：先收口再迁移；每步独立可回滚；不改变“出题/判分确定性”的既有红线。
> 基线：DSH 0.1.5-rc.3、Node 22.19、单机单进程、nginx 2008 端口、现有 5 份云端画像。
> 本文所有主机名、密钥、IP 均用占位符，不写入仓库。

## 一、目标与验收

| 编号 | 目标 | 验收标准 |
|---|---|---|
| P0-1 | 关闭 DSH 通用工具面 | `request/header` 从约 25KB 降到 <2KB；`tools` 为空；session log 无工具调用 |
| P0-2 | 服务降权与文件隔离 | 非 root 运行；`.env` 不在 workspace 且 0600；`systemd-analyze security` 明显改善；重启后功能正常 |
| P0-3 | 鉴权与限流 | 无 token 的画像读写返回 401；PIN 暴力尝试被 429/锁定；LLM 接口有 IP+家庭双限流 |
| P0-4 | 记忆闭环 | 本地匿名 ID 也会产生 `tutor-<id>-<scene>` 会话；第二轮复用；重启后可 resume；不同场景不串会话 |
| P0-5 | 可靠性与多供应商 | dsh 25s 超时；连续 3 次失败熔断 10 分钟；主供应商 403 时独立第二供应商可返回；deep health 可见 |
| P0-6 | 语音隐私 | UI/文档不再声称“音频不出设备”；有明示告知；语音开关可控；会话/语音数据有保留期与删除入口 |

## 二、实施顺序

```
P0-1 工具面收口（0.1.5 先上线）
  └─ P0-2 systemd 降权 + 数据目录迁移
       └─ P0-3 鉴权/限流（后端 shadow → 前端 token → enforce）
            ├─ P0-4A DSH 0.2.1 canary（resumeSession 前置）
            │    └─ P0-4B 记忆闭环（本地 ID / 分场景 session / resume）
            └─ P0-5 可靠性 + 多供应商
                 └─ P0-6 语音隐私与保留期
```

依赖关系：
- P0-2 的 `DATA_DIR` 迁移必须先于 P0-3 的 auth 文件落盘，否则权限会反复踩坑。
- P0-4B 的 `resumeSession` 依赖 P0-4A；本地匿名 ID 和分场景 session 可以先在 0.1.5 上做。
- P0-5 的第二供应商需要新 key；key 未到位时先完成配置、熔断、超时和 deep health，fallback 置空并明确告警。

## 三、P0-1 收口 DSH 工具面

### 改动点
- `apps/server/dsh-runtime/tutor.patch.yml`
- 新增 `scripts/dsh-smoke.mjs`（本地/服务器共用冒烟）
- 可选：`apps/server/dsh-runtime/README.md` 记录行 id 与验证方法

### 关闭清单
在 patch 中按 id 逐行关闭；`disabled: true` 只作用于该行，不删除服务。

必关：
- 命令/文件/网络：`tool-bash`、`tool-pwsh`、`tool-jobs`、`tool-fs`、`tool-fs-search`、`tool-web`、`web`、`web-search-deepseek`、`web-fetch-http`
- 技能/命令：`skill`、`skill-filesystem`、`skill-badge`、`tool-skill`、`commands`、`command-feedback`
- 目标/计划：`goal`、`goal-round-driver`、`command-goal`、`tool-goal`、`plan-mode`
- 子代理/工作流：`subagent`、`subagent-spawn-in-process`、`subagent-fork-in-process`、`tool-subagent`、`tool-subagent-control`、`tool-subagent-list-agents`、`tool-subagent-fork`、`workflow-worker-thread`、`tool-workflow`
- 其他工具：`tool-todo`、`tool-ralph`、`repeat-tool-reminder`、`agent-instructions`、`user-questions`

保留：
- `llm`、`llm-deepseek`、`session`、`session-persistence-jsonl`、`system-prompt`
- `token-meter`、`compaction-basic`、`session-checkpoint-policy`（0.1.5 base 已自带，不要误删）
- `tools` 注册表本身保留，只是没有工具生产者
- `session-title-llm` 在 sdk-app patch 中已是 disabled，保持

### 细节
- 不要改用 `dsh-sdk-minimal`：它虽然少插件，但挂 `terminal-bash`/`persistent-bash`，且 `sandbox-policy.mode = danger-full-access`，风险更高。
- `plan-mode` 行内含大段规划提示词，是 25KB header 的主要来源之一，必须关闭。
- 关闭 `web-*` 同时消除 0.2.1 中 `web-deepseek-api` 复用 `DEEPSEEK_API_KEY`（Kimi key）导致 401 的隐患。
- 先在 0.1.5 上线本 patch，再升级 0.2.1；这样升级失败回退到 0.1.5 时仍是安全状态。
- 关闭后如果 agent-loop 报缺少服务，优先检查是否误关了 `tools`、`session` 或 `agent`，不要盲目恢复工具行。

### 验证
1. 本地：
   ```bash
   DSH_HOME=/tmp/dsh-smoke node scripts/dsh-smoke.mjs
   ```
   脚本输出：`sessionId`、`headerBytes`、`toolsCount`、`latencyMs`、`finalResponse`。
2. 期望：`toolsCount = 0`，`headerBytes < 2048`，回复正常。
3. 服务器：重启后抽样最新 `session.v3.jsonl.zstd`，`request/header` 行长度 <2KB，且不包含 `"name":"bash"`。
4. 回归：sprite/review 两个场景各请求一次，journalctl 无 `tool`、`sandbox` 相关报错。

### 回滚
- 备份 `tutor.patch.yml`；失败时恢复文件并 `systemctl restart dsh-math-tutor`，3 分钟内完成。
- 若只是某个 `disabled` 行导致启动失败，逐行二分恢复；不要一次性恢复全部工具。

## 四、P0-2 服务降权与文件隔离

### 改动点
- 新增 `deploy/systemd/dsh-math-tutor.service`（仓库内模板）
- `apps/server/src/config.ts` 增加 `dataDir`、`authSecret`、`authTokenTtl`
- `apps/server/src/routes/profile.ts`、`score.ts`、`visit.ts`、`chat.ts` 改用 `config.dataDir`
- 服务器 `/etc/dsh-math-tutor.env`、`/etc/systemd/system/dsh-math-tutor.service`

### 目录与权限
- 新建系统用户：`dshtutor`，无登录 shell。
- 代码：`/opt/dsh-math-tutor/server`，`root:dshtutor`，目录 0750，文件 0640/0750。
- 运行数据：`/var/lib/dsh-tutor/{sessions,data}`，`dshtutor:dshtutor`，目录 0700。
- 环境文件：`/etc/dsh-math-tutor.env`，`root:dshtutor 0640`；不再使用 `--env-file=.env`。
- 迁移现有 `server/data/*` 到 `/var/lib/dsh-tutor/data/`，保留 `profiles/`、`nicknames.json`、`scores.json`、`visits.jsonl`、`chat-metrics.jsonl`。

### systemd 模板
```ini
[Service]
User=dshtutor
Group=dshtutor
WorkingDirectory=/opt/dsh-math-tutor/server
EnvironmentFile=/etc/dsh-math-tutor.env
Environment=DSH_HOME=/var/lib/dsh-tutor
Environment=DATA_DIR=/var/lib/dsh-tutor/data
Environment=DSH_PERMISSION_MODE=read-only
ExecStart=/opt/node22/bin/node --experimental-strip-types src/index.ts
Restart=always
RestartSec=3
UMask=0077
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
LockPersonality=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
ReadWritePaths=/var/lib/dsh-tutor
CapabilityBoundingSet=
```

### 细节
- 不要加 `MemoryDenyWriteExecute=yes`：Node/V8 JIT 会失败。
- 先 `chown -R dshtutor:dshtutor /var/lib/dsh-tutor`，再启动；否则 session 持久化会 500。
- `ProtectSystem=strict` 下 `/opt/dsh-math-tutor/server` 只读；应用不能再写 `process.cwd()/data`，所以 `DATA_DIR` 改造必须先完成。
- `.env` 从 workspace 移走后，dsh 子进程的 `env` 仍由 `dsh.ts` 显式注入 `DEEPSEEK_*`，不受影响；但要确认 systemd `EnvironmentFile` 里的值能被 Node 读取。
- `authSecret` 写入 `/etc/dsh-math-tutor.env`，至少 32 字节随机值；不要复用 LLM key。
- 本地开发仍可保留 `apps/server/.env` 和 `--env-file`；生产只用 systemd。

### 验证
- `systemctl daemon-reload && systemctl restart dsh-math-tutor`
- `systemctl show dsh-math-tutor -p User -p Group -p NoNewPrivileges -p ProtectSystem`
- `curl -s http://127.0.0.1:8787/api/health`
- 触发一次练习/点评，确认 `/var/lib/dsh-tutor/sessions` 有新目录且属主为 `dshtutor`。
- `systemd-analyze security dsh-math-tutor` 记录前后分数。

### 回滚
- 备份旧 unit 和 `/opt/dsh-math-tutor/server/data`。
- 回滚时恢复 unit、`chown -R root:root`（或旧属主）、`daemon-reload`、restart；数据目录先复制回原位再启动。

## 五、P0-3 鉴权与限流

### 5.1 nginx 限流
新增 `/etc/nginx/conf.d/dsh-math-tutor-limits.conf`：
```nginx
limit_req_zone $binary_remote_addr zone=dsh_api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=dsh_llm:10m rate=2r/s;
limit_conn_zone $binary_remote_addr zone=dsh_conn:10m;
limit_req_status 429;
```

在 2008 server 块：
```nginx
client_max_body_size 64k;

location /api/ {
    limit_req zone=dsh_api burst=20 nodelay;
    limit_conn dsh_conn 20;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_http_version 1.1;
    proxy_read_timeout 60s;
    proxy_pass http://127.0.0.1:8787;
}

location ~ ^/api/(chat|hint|review|sprite-advice|weekly-report) {
    limit_req zone=dsh_llm burst=5 nodelay;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_http_version 1.1;
    proxy_read_timeout 60s;
    proxy_buffering off;
    proxy_pass http://127.0.0.1:8787;
}
```
- `location ~` 会覆盖前缀 `/api/`，所以 LLM 路由只吃 `dsh_llm`，不会双倍限流。
- `/api/hint/stream` 必须 `proxy_buffering off`，否则 SSE 会被 nginx 缓冲。
- 改完先 `nginx -t`，再 `systemctl reload nginx`；不要直接 restart 影响同机其他站点。

### 5.2 应用层限流
新增 `apps/server/src/services/guard.ts`：
- `clientIp(req)`：只信任本机 nginx 写入的 `X-Real-IP`；若 socket 非 127.0.0.1，忽略该头。
- `take(key, limit, windowMs)`：内存滑动窗口；每 5 分钟清理过期 key；上限 10000 个 key。
- `llmGuard(req, familyId?)`：IP 60 次/5 分钟，family 20 次/5 分钟；超限返回 429 + `Retry-After`。
- `authGuard(req, nickname)`：IP+nickname 5 次/10 分钟；10 次失败锁 30 分钟。
- `bodyGuard(req)`：`content-length > 64KB` 直接 413；读取时累计字节，超限中止。

接入点：
- `/api/chat`、`/api/hint`、`/api/hint/stream`、`/api/review`、`/api/sprite-advice`、`/api/weekly-report`：`llmGuard`
- `/api/profile/resolve-nickname`、`/api/auth/*`：`authGuard`
- `/api/score/submit`、`/api/profile/*` 写接口：`llmGuard` 的通用桶 + auth
- `host.ts`：JSON 解析失败返回 400，不再冒泡成 500；body 超限返回 413。

### 5.3 鉴权
P0 采用 **HMAC 签名 token**，不引入 session 表：
- `POST /api/auth/register`：`{nickname, pin, consent:true}` → 服务端生成 `familyId`、scrypt 存 PIN、返回 `{familyId, token}`。
- `POST /api/auth/login`：`{nickname, pin}` → 校验 PIN，返回 `{familyId, token}`。
- `GET /api/auth/status?nickname=`：只返回 `{exists, hasPin}`，绝不返回 familyId。
- `POST /api/auth/rotate`：已登录时轮换 token（可选）。
- token 格式：`v1.<familyId>.<exp>.<hmac>`，HMAC-SHA256，`AUTH_SECRET`，TTL 30 天。
- `requireAuth(req, familyId)`：校验签名、过期时间、familyId 匹配；失败 401。
- 需要 auth 的接口：`GET/PUT /api/profile/:id`、`/api/profile/goal`、`/api/profile/claim-nickname`、`/api/profile/set-pin`、`/api/score/submit`。
- `resolve-nickname` 不再返回 familyId；前端改为调用 `/api/auth/login`。
- PIN：新用户 6 位；旧 4–6 位可登录但提示升级；hash 从 `sha256(static salt)` 迁到 `scrypt(pin, random salt)`，登录成功时自动升级。
- 前端 `sync.ts` 增加 `getToken/setToken/authHeaders`；`pullProfile`、`pushProfile`、goal、score 全部带 `Authorization: Bearer`。
- token 存 localStorage，P0 可接受；同时补 CSP 降低 XSS 风险；P1 再评估 HttpOnly cookie + CSRF。

### 5.4 迁移 5 份现有画像
- 现有 profile 没有 auth 记录，不能直接登录。
- 方案 A（推荐，数据量小）：管理脚本为每个 familyId 生成一次性 setup code，家长首次登录时设置 6 位 PIN 并领取 token；旧 profile 原样保留。
- 方案 B：允许 legacy familyId 只读 24 小时，期间强制设置 PIN；24 小时后关闭 legacy 入口。不要长期保留。
- `claim-nickname` 必须带 token；`set-pin` 必须带 token。
- 前端 401 时显示“请重新验证设备”，引导昵称+PIN 登录，不静默失败。

### 验证
- 无 token `GET /api/profile/<id>` → 401；带 token → 200。
- 连续 6 次错误 PIN → 429/锁定；正确 PIN 在锁定结束后可登录。
- 30 次快速 `/api/sprite-advice` → 出现 429；正常间隔请求不误伤。
- `curl -H 'content-length: 100000'` 或大 body → 413。
- `nginx -T` 确认限流 zone 与 location 生效。

### 回滚
- nginx 配置备份；`nginx -t` 失败自动回滚。
- 后端加 `AUTH_ENFORCE=false` 开关：shadow 模式只校验不拦截，观察 24 小时；确认前端已带 token 后改 true。
- token 密钥轮换只影响登录态，不影响数据。

## 六、P0-4A DSH 0.2.1 canary

### 目标
- 拿到 `resumeSession`、更新的 session/wait 语义、token-meter 与 compaction 能力。
- 不一次性全量切换；保留 0.1.5 回退包。

### 步骤
1. 本地 `/tmp/dsh021-smoke` 安装 `@deepseek-ai/dsh@0.2.1-rc.2` + `dsh-sdk-client@0.2.1-rc.2`。
2. 复制 P0-1 的无工具 `tutor.patch.yml`，验证：
   - `profile: 'sdk'` 启动；
   - `DEEPSEEK_BASE_URL` 指向 Kimi 网关；
   - `k3` 模型与 `thinking: disabled` 生效；
   - persona 生效；
   - 两轮会话同 sessionId；
   - `resumeSession` 在重启后可恢复；
   - `request/header` <2KB。
3. 服务器备份 `dsh-runtime/`、`package-lock.json`、`sessions/`。
4. 更新 `dsh-runtime/package.json` 到 `0.2.1-rc.2`，`npm install --omit=dev`。
5. 先只让 `?provider=dsh` 的 sprite/review 走新运行时；`AGENT_PROVIDER` 暂不改。
6. 观察 48 小时：journalctl 零降级、延迟、空返回、session 恢复。

### 0.2.1 注意点
- base 新增 `web-deepseek-api` 默认读 `DEEPSEEK_API_KEY`；我们注入的是 Kimi key，必须禁用/覆盖，否则搜索 401。
- 发布说明称默认 SDK persona 改为通用 Agent，但 0.2.1-rc.2 的 `sdk-app` 包内仍写 coding agent；继续用 `system-prompt` patch 覆盖。
- `custom SDK runtimes must support session/wait` 对我们是 SDK client 路径，不涉及自研 runtime。
- `sdk-minimal` 仍带 terminal/persistent-bash 且 `danger-full-access`，不要作为“安全简化”方案。
- 0.2.0 没有正式版；这是 canary，不是“稳定版升级”。

### 回滚
- 恢复 `dsh-runtime` 备份 + `npm ci` + restart；`AGENT_PROVIDER` 未变时用户无感。
- 旧会话格式不兼容时，保留 `sessions.bak-0.1.5`，新会话重新建立；不要把旧目录直接删掉。

## 七、P0-4B 记忆闭环

### 前端
新增 `apps/web/src/lib/learner.ts`：
```ts
const KEY = 'dsh-math-tutor:learner-id'
export function getLearnerId(): string {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = `l-${crypto.randomUUID()}`
    localStorage.setItem(KEY, id)
  }
  return id
}
```
- 不依赖 `familyId`、不依赖云同步、不含身份信息。
- `profileSummary()` 保持匿名，最多 300 字；补充“最近一次正确率、top 错因、平均用时”。
- `ResultView.tsx:99` 去掉 `syncEnabled()` 条件，始终传 `history: profileSummary()` 和 `learnerId`。
- `Sprite.tsx` 的 hint payload、`src/api/sprite.ts`、`VoiceChat.tsx` 都补 `learnerId` + `history`。
- `review.ts`、`sprite.ts`、`chat.ts` 的服务端请求类型补字段。

### 服务端
- `AgentRequest` 增加 `learnerId`、`scene`；`respond` 透传。
- `DshRequest` 增加 `learnerId`、`scene`。
- sessionId：
  ```ts
  const who = req.learnerId ?? req.familyId ?? null
  const sessionId = who
    ? `tutor-${sanitize(who)}-${req.scene}-${isoWeek()}`
    : undefined
  ```
  `sanitize` 只保留 `[a-z0-9-]`，截断 48 字符；`isoWeek()` 让会话每周自然轮换，避免无限增长。
- 不同场景独立 session：`hint`、`review`、`sprite`、`chat` 不共用一个会话；`weekly` 可无 session。
- `resumeSession`：
  - 维护 `activeSessions: Set<string>`；
  - 首次遇到某 session：若 client 有 `resumeSession`，先 `await resumeSession(id)`，失败则 `session(id)`；
  - 已在 `activeSessions` 的，直接 `session(id).run()`；
  - transport/closed 错误时清空 `activeSessions` 并 `resetHarness()`。
- 首轮拼 `system + user`；成功后标记 `primed`，后续只发 user，避免每轮重复 system 提示词。session 轮换/重启后 `primed` 清空。
- 服务端上下文合并：`buildLearnerContext(familyId)` + `req.history`，去重后用 `；` 拼接。
- 限制：单次 prompt 最大 8KB；超出截断 `history`，保留最近一次成绩与 top 3 错因。

### 验证
1. 本地两次调用同 `learnerId + scene`：只生成一个 `tutor-...` 目录，second turn 能引用 first turn。
2. 换 scene：生成不同目录。
3. 关闭 harness 再启动：`resumeSession` 成功，第二轮仍记得。
4. 服务器：`find /var/lib/dsh-tutor/sessions -maxdepth 2 -name 'tutor-*'` 有结果；session log 中出现 `孩子近期情况：`。
5. 关闭云同步的浏览器也能触发（本地 learnerId 路径）。

### 回滚
- `LEARNER_MEMORY=false` 时退回旧逻辑（familyId 或无 session）；本地 ID 仍可保留，不影响数据。
- 分场景 session 出问题时，先合并回单场景，不要删旧 session 目录。

## 八、P0-5 可靠性与多供应商

### 配置
`apps/server/src/config.ts` 增加：
```ts
fallback: {
  baseUrl: process.env.LLM_FALLBACK_BASE_URL ?? '',
  apiKey: process.env.LLM_FALLBACK_API_KEY ?? '',
  model: process.env.LLM_FALLBACK_MODEL ?? '',
}
```
- 第二供应商必须是独立账号/独立配额：DeepSeek 官方、GLM、Qwen 任一。
- 未配置 key 时，fallback 置空并在 deep health 中显示 `fallback: "unconfigured"`；不要假装有兜底。

### 代码
- `llm.ts` 抽出 `chatWith(config, messages, maxTokens, timeoutMs)`；`chat()` 用主配置，`chatFallback()` 用 fallback。
- `agent.ts` 增加 `respondDetailed()`，返回 `{text, provider, degraded, latencyMs}`；保留 `respond()` 兼容旧路由。
- 调用链：
  1. `dsh`（若启用）
  2. 主 Kimi
  3. 独立 fallback
- 熔断：`services/circuit.ts` 按 provider 记录 5 分钟窗口；连续 3 次失败 open 10 分钟；成功一次 reset。
- 超时：`chat` 25s；`chatStream` 45s；dsh `run` 用 `Promise.race` 25s，超时 `resetHarness()` 并降级。
- 日志：`data/llm-metrics.jsonl` 记录 `{ts, scene, provider, ok, degraded, ms, errorCode}`，不含 prompt/身份。
- token 用量：从 `result.events` 的 `usage` 事件提取 `input/output/total`，写 `data/llm-usage.jsonl`；`token-meter` 在 0.1.5 base 已存在，先确认它实际输出的字段再决定是否重复采集。
- deep health：`GET /api/health?deep=1` 仅允许本机/管理员 token；检查 dsh start + 一次短 prompt + 主/备 provider 配置 + 熔断状态。`dshHealthCheck` 使用唯一 session id，避免 `session already exists`。
- `/api/health` 保持轻量，不触发模型调用；deep 版本单独限流。

### 验证
- 把主 key 临时改成无效值，fallback 配有效值：`/api/sprite-advice` 返回正常，日志 `provider=fallback`。
- 连续 3 次失败后，第 4 次不再打主 provider；10 分钟后 half-open。
- dsh 超时：用 `?provider=dsh` 构造慢请求，确认 25s 返回 fallback，不挂住 nginx。
- deep health 返回 `{ok:true,dsh:{ok:true},primary:{configured:true},fallback:{configured:true},circuit:{...}}`。

### 回滚
- 移除 `LLM_FALLBACK_*` 即回到单供应商；熔断/超时是纯代码路径，可单独 revert。
- 不要把第二 key 写进仓库或前端；只进 `/etc/dsh-math-tutor.env`。

## 九、P0-6 语音隐私

### 事实修正
- `VoiceChat.tsx` 使用 `SpeechRecognition` / `webkitSpeechRecognition`；Chrome/Edge 通常把音频送到浏览器厂商云端。
- 现有注释“音频不出设备”和 `docs/vision.md` 的表述必须改掉；我们只能承诺“本服务不保存音频”。

### P0 最小动作
- UI 首次使用语音前显示告知：
  “语音识别由浏览器提供，部分浏览器会把音频发送到浏览器厂商服务器；本服务只接收转写文字，不保存音频。”
- 增加 `VOICE_ENABLED` 开关（默认 false，完成告知和回归后打开）；关闭时 `VoiceChat` 只显示文字输入。
- 更新 `docs/vision.md`、`README`、`docs/architecture.md` 的隐私描述。
- 新增 `scripts/prune-data.mjs`：
  - 删除超过 30 天的 DSH session 目录；
  - 轮转 `chat-metrics.jsonl` / `llm-metrics.jsonl`；
  - 默认 dry-run，`--apply` 才删除。
- 增加 `DELETE /api/profile/:id`（需 auth）：删除 profile、nickname 绑定、score；返回删除项清单。
- 语音/会话保留期写入家长同意文案；删除入口写入看板设置。

### 后续（不在本次 P0 实现）
- 自托管 STT（Whisper.cpp / SenseVoice）替代浏览器识别；
- 浏览器 `MediaRecorder` → `/api/stt` → 立即删除临时文件；
- 30 秒上限、儿童语音实测、VAD 调参。

### 验证
- 关闭 `VOICE_ENABLED` 时无麦克风入口；
- 首次打开语音出现告知，未确认不能录音；
- `prune-data.mjs` dry-run 不删文件，`--apply` 只删过期项；
- 删除接口删除后 `GET /api/profile/:id` 404，nickname 可重新注册。

## 十、发布与验证节奏

### Day 0：基线
- 新建分支 `codex/p0-hardening`。
- 备份：`dsh-runtime/`、`server/src/`、`server/data/`、`/etc/systemd/system/dsh-math-tutor.service`、`/etc/nginx/sites-enabled/default`、`/etc/nginx/conf.d/`。
- 记录基线：`request/header` 大小、131 sessions、平均延迟、`systemd-analyze security` 分数。
- `git status` 必须干净；部署只允许 HEAD 构建。

### Day 1：P0-1 + P0-2
- 上午：改 patch，本地 smoke，确认 header <2KB。
- 下午：部署 patch；再部署 systemd + DATA_DIR 迁移。
- 验证：health、sprite/review、session 写入、`systemd-analyze security`。
- 若 systemd 失败：先回退 unit，不要回退 patch。

### Day 2：P0-3
- 后端 shadow 模式上线：有 token 校验，无 token 仍放行但记录 `legacy_access`。
- 前端发版：注册/登录、token 存储、所有 profile/goal/score 请求带 header。
- 观察 24 小时，确认没有 401 风暴；切换 `AUTH_ENFORCE=true`。
- nginx 限流同天上线，先 `nginx -t` + reload。

### Day 3：P0-4A + P0-4B
- 0.2.1 本地 smoke；服务器 canary（sprite/review only）。
- 本地 learnerId + 分场景 session 先上；确认 `tutor-*` 目录。
- 切 `resumeSession`，重启一次验证恢复。

### Day 4：P0-5
- 配置第二供应商；主 key 失效演练；熔断/超时/deep health。
- 观察 48 小时；记录 fallback 次数。

### Day 5：P0-6 + 文档
- 语音告知、开关、prune 脚本、删除接口。
- 文档同步：README/architecture/vision/HANDOFF 的版本、场景、存储、隐私表述。
- 跑 `pnpm --filter web typecheck`，修 6 个历史错误；把 `typecheck + build` 接入 CI。

### 每日收尾
- `journalctl -u dsh-math-tutor --since today | grep -E 'ERROR|降级|401|429|timeout'`
- `curl` 关键接口；抽样 session header；记录 commit hash。
- 部署后在 `docs/progress.md` 记一行。

## 十一、Todo list

### P0-1 工具面
- [ ] 备份 `tutor.patch.yml`，列出 0.1.5/0.2.1 两版行 id 差异
- [ ] 在 patch 中关闭命令/文件/网络/技能/目标/子代理/工作流/计划工具
- [ ] 保留 `tools`、`session`、`session-persistence`、`system-prompt`、`token-meter`、`compaction-basic`
- [ ] 新增 `scripts/dsh-smoke.mjs`，输出 headerBytes/toolsCount/sessionId/latency
- [ ] 本地确认 toolsCount=0、headerBytes<2048
- [ ] 服务器部署 patch，抽样 session log 验证
- [ ] 回归 sprite/review，journalctl 零工具/sandbox 报错

### P0-2 降权
- [ ] 新建 `dshtutor` 系统用户
- [ ] `config.ts` 增加 `dataDir`，四个路由改用 `config.dataDir`
- [ ] 迁移 `server/data` → `/var/lib/dsh-tutor/data`
- [ ] `.env` → `/etc/dsh-math-tutor.env`，0600/0640
- [ ] 写 systemd 模板并部署
- [ ] `chown -R dshtutor:dshtutor /var/lib/dsh-tutor`
- [ ] `systemd-analyze security` 前后对比
- [ ] 验证 session/profile 写入、重启恢复
- [ ] 备份回滚 unit 与数据目录

### P0-3 鉴权限流
- [ ] nginx 新增 `limit_req_zone`、`limit_conn_zone`、`limit_req_status`
- [ ] `/api/` 与 LLM 路由分别限流；stream 关闭 buffering
- [ ] `host.ts` body 上限 64KB，JSON 错误 400
- [ ] 新增 `services/guard.ts`（IP/family/nickname 桶）
- [ ] LLM 路由接入 `llmGuard`，auth 路由接入 `authGuard`
- [ ] 新增 `/api/auth/register|login|status|rotate`
- [ ] HMAC token 签发/校验，`AUTH_SECRET` 进环境文件
- [ ] PIN 迁移 scrypt，新用户 6 位，旧 PIN 登录时升级
- [ ] profile GET/PUT/goal/claim-nickname/set-pin/score submit 加 auth
- [ ] 前端 `sync.ts` 存 token、带 header、401 引导重新登录
- [ ] 现有 5 份画像的一次性 setup code 迁移脚本
- [ ] shadow 模式观察 24h 后 `AUTH_ENFORCE=true`
- [ ] 验证 401/429/413/锁定

### P0-4 记忆
- [ ] 新增 `lib/learner.ts`，本地匿名 ID
- [ ] `ResultView` 去掉 `syncEnabled()` 条件
- [ ] `Sprite`/`sprite.ts`/`VoiceChat` 补 learnerId + history
- [ ] 服务端 Agent/Dsh 请求类型补 learnerId/scene
- [ ] sessionId 改 `tutor-<id>-<scene>-<week>`
- [ ] `activeSessions` + `resumeSession` 兼容 0.1.5/0.2.1
- [ ] 首轮 system+user，后续只发 user
- [ ] 服务端 context 与本地 history 合并、去重、截断
- [ ] 本地两轮/分场景/重启恢复测试
- [ ] 服务器确认 `tutor-*` session 与 `孩子近期情况：`

### P0-5 可靠性
- [ ] `config.ts` 增加 `LLM_FALLBACK_*`
- [ ] 获取独立第二供应商 key 与 base URL
- [ ] `llm.ts` 抽 `chatWith`，`agent.ts` 增加 `respondDetailed`
- [ ] 实现 provider 熔断（3 次/5 分钟，open 10 分钟）
- [ ] dsh 25s 超时 + resetHarness
- [ ] `llm-metrics.jsonl` / `llm-usage.jsonl`
- [ ] `/api/health?deep=1`，唯一 health session
- [ ] 主 key 失效演练，fallback 成功
- [ ] 连续失败熔断演练
- [ ] deep health 返回主/备/熔断状态

### P0-6 语音隐私
- [ ] `VoiceChat` 注释与 UI 告知修正
- [ ] `VOICE_ENABLED` 开关，默认关闭
- [ ] 首次语音前同意勾选
- [ ] 更新 `vision/README/architecture` 隐私表述
- [ ] `scripts/prune-data.mjs`（dry-run/--apply）
- [ ] `DELETE /api/profile/:id`（auth）
- [ ] 看板删除入口与保留期文案
- [ ] 30 天保留期 systemd timer（或 cron）

### 工程收尾
- [ ] 修 6 个 `tsc` 错误
- [ ] CI 加 `pnpm -r typecheck` + `pnpm --filter web build`
- [ ] server 路由冒烟测试（health/auth/rate/session）
- [ ] 更新 `docs/progress.md` 与 `docs/HANDOFF.md`
- [ ] 部署后 commit/push，记录 commit hash

## 十二、风险登记

| 风险 | 等级 | 缓解 |
|---|---|---|
| 关闭工具行导致 agent-loop 缺服务 | 中 | 保留 `tools/session/agent`，本地逐行二分 |
| `ProtectSystem=strict` 导致 session/data 写入失败 | 中 | 先改 `DATA_DIR`，`ReadWritePaths` 覆盖全部写路径 |
| 鉴权迁移锁死现有用户 | 高 | shadow 模式 + 一次性 setup code + 手动恢复脚本 |
| token 存 localStorage 被 XSS 窃取 | 中 | CSP、短 TTL、P1 评估 HttpOnly cookie |
| 限流误伤学校/家庭 NAT | 中 | IP 桶放宽到 60/5min，家庭桶 20/5min，burst 5 |
| 0.2.1 RC 不稳定 | 中 | canary + 48h 观察 + 3 分钟回滚 |
| `resumeSession` 遇到 occupied session | 中 | activeSessions 缓存，occupied 时用 `session(id)` |
| 第二供应商输出风格不一致 | 低 | 同一 system prompt，smoke 对比 |
| 语音告知降低使用 | 低 | 默认关闭，完成告知后再开 |
| 关工具后模型回答变差 | 低 | 教学场景本就不需要 bash/fs/web，用提示词回归 |

## 十三、需要确认的决策

1. 第二供应商选谁、key 由谁提供（DeepSeek 官方 / GLM / Qwen）？
2. 现有 5 份云端画像是否接受“重新设置 6 位 PIN”的一次性迁移？
3. 语音功能是先关闭等自托管 STT，还是先按“浏览器厂商可能上云”的告知上线？
4. DSH 0.2.1 是否允许本周 canary，还是先只做 0.1.5 安全收口？
5. token 存储用 localStorage（快）还是 HttpOnly cookie（更安全但改动大）？

---

> 本文是实施计划，不含代码改动。确认后再按 Todo list 逐项施工；每一步单独构建、部署、验证、记录。

## 十四、不在本次 P0 范围

- 域名/正式证书/443 端口迁移：单独排期；语音告知上线前至少要保证 HTTPS 可用。
- G3–G5 题库与课程内容：P1，不与安全加固混做。
- SQLite/数据库迁移：5 份画像阶段不必要，先做原子写和备份即可。
- 游乐场/核电站新玩法：冻结扩张，避免继续挤占主路径。
- Pipecat 级实时语音：等语音真实使用数据和自托管 STT 评估后再立项。

## 十五、决策锁定（2026-10-20）

1. 第二供应商：今晚 key 到位前保持 Kimi 主链路；`LLM_FALLBACK_*` 先留空并让 deep health 明确显示 `unconfigured`，key 到位后只改环境文件，不阻塞 P0-1/P0-2。
2. 现有 5 份画像：接受“重新设置 6 位 PIN”的一次性迁移；用 setup code 领取 token，旧数据原样保留。
3. 语音：先按“浏览器可能把音频发送到厂商云端、本服务只接收转写文字且不保存音频”的告知上线；`VOICE_ENABLED` 默认 false，告知和回归完成后再打开。
4. DSH 0.2.1：允许直接 canary；先本地 smoke，再服务器仅 sprite/review 灰度，保留 0.1.5 回退包。
5. token：P0 存 localStorage，所有 profile/goal/score 请求带 `Authorization: Bearer`；P1 再评估 HttpOnly cookie。
