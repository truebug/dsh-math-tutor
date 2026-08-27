# 部署指南（coolje00 · 复用 2008 端口）

> 线上地址：**http://120.27.200.203:2008/dsh-math-tutor/**
> 原则：不新增安全组端口，复用 2008（nginx default server）。

## 架构（已上线）

```
浏览器 → http://120.27.200.203:2008/
  ├─ /dsh-math-tutor/   → alias /var/www/html/dsh-math-tutor/（SPA，try_files fallback）
  └─ /api/              → proxy_pass http://127.0.0.1:8787（node 服务，systemd 守护）
```

## 服务器现状（coolje00）

- Node：`/opt/node22/bin/node`（v22.19.0，npmmirror 手动安装）
- 后端：`/opt/dsh-math-tutor/server/`（src + .env + node_modules + dsh-runtime/）
  - `.env` 含 LLM key（仅服务端）
  - `node_modules`：`@deepseek-ai/dsh-sdk-client`（agent 网关 dsh provider 用）
  - `dsh-runtime/`：dsh 运行时（cordis.yml + 独立 node_modules）
- dsh 会话持久化：`/var/lib/dsh-tutor/sessions/`
- 服务：`systemctl status dsh-math-tutor`（Restart=always）
- nginx 配置：`/etc/nginx/sites-enabled/default`（2008 server 块内新增两个 location）
- 备份：`/root/default.bak.*`（注意：备份勿放 sites-enabled，会被 nginx 加载）

## 更新部署流程

> ⚠️ 前后端分开 scp，各自在自己的目录下执行（曾发生前端 src 误覆盖后端的事故）。

数据文件：`server/data/profiles/<familyId>.json`（云端画像）、
`server/data/nicknames.json`（昵称索引：昵称→familyId+可选PIN哈希）。
dsh-runtime 依赖变更时（很少）：
`cd /opt/dsh-math-tutor/server/dsh-runtime && PATH=/opt/node22/bin:$PATH npm install --omit=dev`

```bash
# 本地（仓库根目录）
cd apps/web && VITE_BASE_PATH=/dsh-math-tutor/ pnpm build
scp -r dist coolje00:/tmp/dsh-web
scp -r apps/server/src coolje00:/tmp/src   # 仅后端变更时

# coolje00
ssh coolje00 "rm -rf /var/www/html/dsh-math-tutor && mv /tmp/dsh-web /var/www/html/dsh-math-tutor"
ssh coolje00 "rm -rf /opt/dsh-math-tutor/server/src && mv /tmp/src /opt/dsh-math-tutor/server/src && systemctl restart dsh-math-tutor"
```

## 验证

```bash
curl http://120.27.200.203:2008/api/health          # {"ok":true}
curl -I http://120.27.200.203:2008/dsh-math-tutor/  # 200 text/html
```

## 红线

- DeepSeek API Key 仅存 `/opt/dsh-math-tutor/server/.env`，不进前端产物、不进 git。
- `dsh web` 的 3080 端口仅本地调试，线上不部署、不开放。
