# 目录结构与初始化参考

> 本文档记录项目初始化时的目录设计，随结构演进同步更新。
> 关键约束：最终以 **Web 网页形式发布到线上 nginx 服务器**（coolje00/coolje01 类），详见 README「Web 部署约束」一节与 `docs/deployment.md`。

```
dsh-math-tutor/
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI：构建前端静态产物 → rsync/scp 到 nginx 服务器
├── packages/                     # DSH 插件（插件 = 导出 name + apply(ctx) 的 TS 模块）
│   ├── math-generator/           # 数学题目确定性生成（defineTool，代码出题/判分，不走 LLM）
│   │   ├── src/index.ts
│   │   └── package.json
│   ├── progress-tracker/         # 学习进度追踪
│   │   ├── src/index.ts
│   │   └── package.json
│   └── grade-mapper/             # 沪教版知识点映射
│       ├── src/index.ts
│       ├── src/grades.ts
│       └── package.json
├── apps/
│   ├── web/                      # React 前端（vite build → 纯静态，nginx 直接托管）
│   │   ├── src/
│   │   │   ├── components/       # PracticeView / Dashboard / MistakeBook / GradeSelector
│   │   │   ├── api/              # API 调用层（baseURL 可配置，默认 /api/）
│   │   │   ├── types/
│   │   │   └── App.tsx
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.ts        # base path 由环境变量注入，支持子路径部署
│   └── server/                   # 轻量后端：监听 127.0.0.1:<port>，由 nginx 反代 /api/
│       ├── src/
│       │   ├── index.ts          # 服务入口（原生 http / 轻量框架）
│       │   ├── config.ts         # 端口、DeepSeek API Key 等环境变量
│       │   ├── routes/           # /api/*
│       │   └── services/         # LLM 转发、prompt 构建
│       ├── package.json
│       └── tsconfig.json
├── docs/
│   ├── curriculum/               # 沪教版 2~5 年级语数英知识点对照表（math/chinese/english.md）
│   ├── guide/                    # 用户指南
│   ├── deployment.md             # nginx 部署指南（站点配置、反代、systemd）
│   └── development.md            # 开发指南
├── cordis.yml                    # DSH 插件加载覆盖层（insert 本地插件绝对路径）
├── examples/                     # 示例与测试用例
├── assets/images/                # 静态资源
├── package.json                  # workspace 根，精确锁定 @deepseek-ai/dsh@0.1.1-rc.2
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── LICENSE
└── README.md
```

## 与官方机制对齐的要点

- **插件加载**：不使用每包 `cordis.patch.yml`；官方做法是根目录一份 `cordis.yml`，用 `insert` 列表注入插件模块（绝对路径），启动时 `npx @deepseek-ai/dsh web --config cordis.yml`。
- **工具定义**：面向模型的工具用 `defineTool`（`@deepseek-ai/dsh-tools`）+ `ctx.tools.register()`；math-generator 的出题/判分为确定性代码，仅在需要讲解时调用 LLM。
- **版本锁定**：DSH 处于 developer preview（官方声明有破坏性变更），所有依赖精确锁定，pnpm 用 corepack 固定 `pnpm@10.34.5`。
- **生态**：数学插件稳定后可拆分为独立仓库并添加 `dsh-plugin` topic。

## 参考

- 官方仓库：https://github.com/deepseek-ai/deepseek-harness （本地副本：`../deepseek-harness`）
- 第一个插件教程：`docs/user/develop/basic/index.zh.md`
- 工具编写参考：`docs/cookbook/adding-a-tool.zh.md`
