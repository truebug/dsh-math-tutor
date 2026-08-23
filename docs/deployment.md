# 部署指南（nginx + 现有服务器）

目标环境：coolje00/coolje01 类服务器，nginx 作为唯一对外入口。

## 架构

```
浏览器
  │ 443/80
  ▼
nginx ── 静态站点：/var/www/dsh-math-tutor/        ← apps/web 的 vite build 产物
   └── 反向代理：/api/ → http://127.0.0.1:8787     ← apps/server（systemd 守护）
```

## 前端（纯静态）

```bash
pnpm --filter web build          # 产物在 apps/web/dist/
rsync -avz --delete apps/web/dist/ user@server:/var/www/dsh-math-tutor/
```

- 子路径部署：构建前设置 `VITE_BASE_PATH=/dsh-math-tutor/`。
- API 前缀默认 `/api/`，可用 `VITE_API_BASE` 覆盖。

## 后端（systemd 守护）

```ini
# /etc/systemd/system/dsh-math-tutor.service
[Service]
Environment=SERVER_PORT=8787
Environment=DEEPSEEK_API_KEY=sk-xxx   # 仅存于服务端
ExecStart=/usr/bin/node --experimental-strip-types /opt/dsh-math-tutor/server/src/index.ts
Restart=always
```

## nginx 配置要点

```nginx
location /dsh-math-tutor/ {
  alias /var/www/dsh-math-tutor/;
  try_files $uri $uri/ /dsh-math-tutor/index.html;   # SPA fallback
}
location /api/ {
  proxy_pass http://127.0.0.1:8787;
  proxy_set_header Host $host;
  # 未来若引入 SSE/WebSocket：
  # proxy_buffering off;                            # SSE
  # proxy_set_header Upgrade $http_upgrade;         # WebSocket
  # proxy_set_header Connection "upgrade";
}
```

## 红线

- DeepSeek API Key 不进入前端产物；`dsh web` 的 3080 端口仅本地调试，不对外开放。
