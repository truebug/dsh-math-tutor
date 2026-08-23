# dsh-math-tutor

> 基于 DeepSeek Harness 的小学语数英辅助教学 AI 助手（沪教版 2~5 年级），从数学随堂练习起步

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/Powered%20by-DeepSeek%20Harness-orange)](https://github.com/deepseek-ai/deepseek-harness)
[![dsh](https://img.shields.io/badge/dsh-0.1.1--rc.2-red)](https://www.npmjs.com/package/@deepseek-ai/dsh)

## 项目简介

**dsh-math-tutor** 面向小学二年级至五年级（沪教版）学生，基于 DeepSeek Harness (`dsh`) 智能体框架构建，以 Web 网页形式对外提供服务。项目从 **100 以内加减法速算** 起步，逐步扩展至沪教版小学数学全知识点体系，后续按「数学 → 语文 → 英语」顺序扩展，为孩子提供随年级增长不断更新的智能随堂练习。

## 愿景：因材施教，各走各路

选择 DeepSeek Harness 的核心理由，是期待 AI agent **伴随孩子成长**：在长期陪伴中充分掌握每个孩子的个性化特征——优势与薄弱点、节奏偏好、易错类型——并动态匹配对应的难度、进度与重点，而不是千人一面、从头到尾的枯燥灌输。

这是理想状态，不会一步到位。起步阶段从既有常见范式开始（固定知识点的确定性练习），逐步积累学习者画像（learner profile），让 agent 的推荐与讲解越来越「懂这个孩子」。**AI agent 和孩子共同成长，才是本项目真正追求的目标。** 详细演化路径见 [docs/vision.md](docs/vision.md)。

### 核心特性

- 🎯 **沪教版同步**：知识点覆盖沪教版 2~5 年级教材（见 `docs/curriculum/`）
- ⚡ **确定性出题**：算术题由代码确定性生成与判分，零成本、零延迟、永不出错
- 🧠 **AI 辅助讲解**：DeepSeek 负责解题思路讲解、错题归因与鼓励反馈，不参与出题判分
- 📈 **渐进式学习**：随年级自动升级难度，练习记录与错题本追踪成长轨迹
- 👶 **儿童友好**：大字体、清晰反馈、温和激励
- 🔒 **隐私优先**：练习数据默认仅存储于浏览器 localStorage，不上传服务器
- 🌱 **个性化成长**：agent 基于学习者画像动态调整难度与重点，与孩子共同成长

### 设计原则

1. **确定性与 AI 分工**：凡是代码能可靠完成的（出题、判分、计时、统计），不交给 LLM；LLM 只做讲解、归因、鼓励等开放性任务。
2. **一切皆插件**：功能以 DSH 插件形式组织（`packages/`），插件 = 导出 `name` + `apply(ctx)` 的 TS 模块，通过 `cordis.yml` 覆盖层加载。
3. **纯 Web 交付**：最终产物必须能以静态页面 + 轻量 API 的形式部署到普通 nginx 服务器。

## Web 部署约束

本项目目标环境为已有 nginx 服务器（coolje00/coolje01 类），架构与技术选型必须满足以下约束：

- **前端纯静态化**：`apps/web` 必须 `vite build` 产出纯静态文件，直接放入 nginx 站点目录即可运行，不依赖 Node 运行时。
- **后端轻量可反代**：`apps/server` 以普通 HTTP 服务监听 `127.0.0.1:<port>`，由 nginx 反向代理转发（如 `/api/` → `127.0.0.1:8787`）；用 systemd 守护，不占用 80/443。
- **API Key 不出服务端**：DeepSeek API Key 只存在于服务器环境变量中，前端永不接触；所有 LLM 调用必须经由后端转发。
- **DSH Web UI 不直接暴露**：`dsh web` 自带的 `http://127.0.0.1:3080` 仅用于开发调试，线上不对外开放。
- **慎用 WebSocket**：MVP 阶段只使用普通 HTTP 请求/响应（轮询可接受）；若后续引入 WebSocket/SSE，需同步更新 nginx 配置（`Upgrade`/`Connection` 头或 `proxy_buffering off`）。
- **部署路径可配置**：前端 base path 与 API 前缀通过环境变量注入，支持部署到子路径（如 `/dsh-math-tutor/`）。

## 技术栈

| 层 | 技术 | 用途 |
|---|---|---|
| AI 框架 | DeepSeek Harness `@deepseek-ai/dsh@0.1.1-rc.2`（精确锁定） | Agent 运行时与插件系统（Cordis） |
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS | 纯静态构建产物 |
| 后端 | Node.js（原生 http 或轻量框架） | API 转发与业务逻辑，nginx 反代 |
| 存储 | localStorage（MVP）→ 服务端 JSON/SQLite（后续） | 练习记录与错题本 |
| 部署 | nginx 静态托管 + reverse proxy + systemd | 复用现有服务器 |

## 快速开始

### 前置要求

- Node.js 22.19+ 或 24+
- pnpm（建议 `corepack enable`，锁定 `pnpm@10.34.5`）
- DeepSeek API Key（仅后端需要）

### 开发模式

```bash
git clone https://github.com/truebug/dsh-math-tutor.git
cd dsh-math-tutor
pnpm install
pnpm dev:web        # 速算挑战页：http://localhost:5173
```

MVP 已可用：首次访问填写「我是谁」（昵称/性别/年龄/年级/科目，仅存本地），
随后进入 100 以内加减法计时挑战（默认 60 题 / 5 分钟），自动判分出成绩报告，
错题自动进错题本；出题由浏览器本地确定性完成（`packages/math-generator` 核心），
**竞赛码**（如 `G2A-60-300-839201`）= 参数 + 种子，同码同题，是多人对战的基础。

```bash
# 可选：DSH Web UI 调试插件（cordis.yml 覆盖层，需替换 <REPO_ROOT>）
npx @deepseek-ai/dsh@0.1.1-rc.2 web --config cordis.yml
```

## 项目结构

```
dsh-math-tutor/
├── packages/                  # DSH 插件包
│   ├── math-generator/        # 数学题目确定性生成插件（defineTool）
│   ├── progress-tracker/      # 学习进度追踪插件
│   └── grade-mapper/          # 沪教版知识点映射插件
├── apps/
│   ├── web/                   # React 前端（纯静态构建，nginx 托管）
│   └── server/                # 轻量后端（API Key 保管 + LLM 转发，nginx 反代）
├── docs/
│   ├── curriculum/            # 沪教版 2~5 年级语数英知识点对照表
│   ├── guide/                 # 用户指南
│   ├── architecture.md        # 技术架构基线（coding 前必读）
│   ├── deployment.md          # nginx 部署指南
│   └── development.md         # 开发指南
├── cordis.yml                 # DSH 插件加载覆盖层
├── examples/                  # 示例与测试用例
├── assets/                    # 静态资源
└── .github/workflows/         # CI/CD（构建 → 部署到 nginx 服务器）
```

## 路线图

- [x] Phase 1: 100 以内加减法速算（二年级）— 确定性出题 + 判分 + 计时（MVP 单机版）
- [ ] Phase 2: 表内乘除法（二~三年级）
- [ ] Phase 3: 多位数加减法（三年级）
- [ ] Phase 4: 小数初步认识与计算（四年级）
- [ ] Phase 5: 简易方程与几何（五年级）
- [ ] Phase 6: 语文 / 英语辅助模块（待规划）
- [ ] Phase 6.5: 多人竞技（server relay 对战房间，基于竞赛码同题竞速）
- [ ] Phase 7: 学习者画像与自适应推荐（错题模式识别 → 难度/进度动态匹配）
- [ ] 数学插件稳定后拆分为独立仓库，并打 `dsh-plugin` topic 便于社区发现

> ⚠️ DeepSeek Harness 处于 developer preview，官方声明存在兼容性破坏变更，因此 package.json 中必须精确锁定 `@deepseek-ai/dsh@0.1.1-rc.2`。

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

[MIT](LICENSE)
