# 开发指南

## 环境

- Node.js 22.19+ / 24+；`corepack enable` 固定 `pnpm@11.7.0`
- DeepSeek Harness 精确锁定 `@deepseek-ai/dsh@0.1.1-rc.2`（developer preview，存在破坏性变更，升级前需回归测试）

## 常用命令

```bash
pnpm install
pnpm dev:web        # 前端开发服务器（/api 代理到 127.0.0.1:8787）
pnpm dev:server     # 后端
npx @deepseek-ai/dsh@0.1.1-rc.2 web --config cordis.yml   # DSH Web UI 调试插件
```

## 插件开发

插件 = 导出 `name` + `apply(ctx)` 的 TS 模块；在 `cordis.yml` 的 `insert` 列表中用**绝对路径**注册。
工具用 `defineTool`（`@deepseek-ai/dsh-tools`）+ `ctx.tools.register()`。
官方文档（本地副本 `../deepseek-harness`）：

- 第一个插件：`docs/user/develop/basic/index.zh.md`
- 工具编写参考：`docs/cookbook/adding-a-tool.zh.md`

## 原则

出题/判分/统计一律确定性代码实现；LLM 仅用于讲解、错题归因、鼓励反馈。
