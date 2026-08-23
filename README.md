# dsh-math-tutor

> 基于 DeepSeek Harness 的小学数学智能随堂练习助手 —— 沪教版 2~5 年级

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/Powered%20by-DeepSeek%20Harness-orange)](https://github.com/deepseek-ai/deepseek-harness)

## 📖 项目简介

**dsh-math-tutor** 是一个面向小学二年级至五年级（沪教版）学生的 AI 辅助教学工具，基于 DeepSeek Harness (`dsh`) 智能体框架构建。项目从 **100以内加减法速算** 起步，逐步扩展至沪教版小学数学全知识点体系，为孩子提供**随年龄增长不断更新的智能随堂练习**。

### ✨ 核心特性

- 🎯 **沪教版同步**：知识点覆盖沪教版 2~5 年级数学教材
- 🧠 **AI 智能出题**：基于 DeepSeek 动态生成个性化练习题
- 📈 **渐进式学习**：从 100 以内加减法起步，随年级自动升级难度
- 📊 **学习追踪**：错题本、练习记录、成长轨迹
- 👶 **儿童友好**：大字体、清晰反馈、温和激励
- 🌐 **纯 Web 运行**：浏览器即可使用，无需安装

### 🗺️ 路线图

- [x] Phase 1: 100以内加减法速算（二年级）
- [ ] Phase 2: 表内乘除法（二年级~三年级）
- [ ] Phase 3: 多位数加减法（三年级）
- [ ] Phase 4: 小数初步认识与计算（四年级）
- [ ] Phase 5: 简易方程与几何（五年级）
- [ ] Phase 6: 语文/英语辅助模块（待规划）

## 🛠️ 技术栈

| 层 | 技术 | 用途 |
|---|---|---|
| AI 框架 | DeepSeek Harness (`dsh`) | Agent 运行时与插件系统 |
| 前端 | React 19 + TypeScript | UI 框架 |
| 构建 | Vite | 构建工具 |
| 样式 | Tailwind CSS | 样式方案 |
| 后端 | Node.js + Express | API 服务 |
| 存储 | localStorage / JSON | 数据持久化 |

## 🚀 快速开始

### 前置要求
- Node.js ≥ 22[reference:9]
- npm 或 pnpm

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/your-username/dsh-math-tutor.git
cd dsh-math-tutor

# 安装依赖
pnpm install

# 构建 DeepSeek Harness
pnpm run build

# 启动 Web 服务
pnpm dsh web
```

浏览器打开 `http://127.0.0.1:3080` 即可开始使用[reference:12]。

## 📁 项目结构

```
dsh-math-tutor/
├── packages/              # DSH 插件包
│   ├── math-generator/    # 数学题目生成插件
│   ├── progress-tracker/  # 学习进度追踪插件
│   └── grade-mapper/      # 沪教版知识点映射插件
├── apps/
│   ├── web/               # React 前端
│   └── server/            # Node.js 后端
├── docs/                  # 文档
├── assets/                # 静态资源（图片、图标等）
├── examples/              # 示例与测试用例
├── LICENSE
└── README.md
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！请参考 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 📄 许可证

[MIT](LICENSE)
