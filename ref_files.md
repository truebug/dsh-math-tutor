dsh-math-tutor/
├── .github/                    # GitHub 配置
│   └── workflows/              # GitHub Actions CI/CD
│       └── deploy.yml          # 自动部署配置
├── packages/                   # DSH 插件包（核心扩展）[reference:16]
│   ├── math-generator/         # 数学题目生成插件
│   │   ├── src/
│   │   │   └── index.ts        # 插件主代码（defineTool）[reference:17]
│   │   ├── package.json        # @dsh-math-tutor/math-generator
│   │   └── cordis.patch.yml    # Cordis 配置覆盖[reference:18]
│   ├── progress-tracker/       # 学习进度追踪插件
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   └── grade-mapper/           # 沪教版知识点映射插件
│       ├── src/
│       │   ├── index.ts
│       │   └── grades.ts       # 2-5年级知识点映射
│       └── package.json
├── apps/                       # 应用层[reference:20]
│   ├── web/                    # React 前端
│   │   ├── src/
│   │   │   ├── components/     # UI 组件
│   │   │   │   ├── PracticeView.tsx    # 答题界面
│   │   │   │   ├── Dashboard.tsx       # 学习仪表盘
│   │   │   │   ├── MistakeBook.tsx     # 错题本
│   │   │   │   └── GradeSelector.tsx   # 年级选择器
│   │   │   ├── hooks/          # 自定义 Hooks
│   │   │   ├── api/            # API 调用层
│   │   │   ├── types/          # TypeScript 类型定义
│   │   │   └── App.tsx
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── server/                 # Node.js 后端
│       ├── src/
│       │   ├── index.ts        # 服务入口
│       │   ├── config.ts       # 环境配置
│       │   ├── routes/         # API 路由
│       │   ├── services/       # 业务逻辑
│       │   │   ├── generator.ts       # AI 出题引擎
│       │   │   ├── promptBuilder.ts   # Prompt 构建
│       │   │   └── grades.ts          # 知识点映射
│       │   └── db/             # 数据存储层
│       ├── package.json
│       └── tsconfig.json
├── docs/                       # 文档
│   ├── guide/                  # 用户指南
│   │   ├── index.md            # 快速上手
│   │   └── grade-mapping.md    # 沪教版知识点对照
│   └── development.md          # 开发指南
├── assets/                     # 静态资源
│   └── images/
├── examples/                   # 示例代码
├── native/                     # 原生模块（如有需要）
├── .gitignore
├── LICENSE                     # MIT 协议
├── package.json                # 根 package.json（workspace 配置）
├── pnpm-workspace.yaml         # pnpm workspace 配置
├── tsconfig.base.json          # 基础 TypeScript 配置
└── README.md
