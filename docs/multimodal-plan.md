# 多模态能力设计方案（语音 / 生图）

## 关键区分：两条链路
1. **网站运行时**（孩子用的网页）：能力是前端/后端代码直接调 API，与 DSH 无关
2. **DSH agent**（开发与运营侧）：装社区插件，帮我们生产内容（如批量生成关卡插画）

## 现状盘点（2026-08-24 调研）
- TTS（网站）：Web Speech API 已上线，零成本。升级路径 = 服务端代理豆包 TTS（火山引擎，童声音色好，需 env 加凭证）
- 生图（资产生产）：DSH 社区已有成熟插件——shanliuling/dsh-image-gen、dickpy/dsh-imagegen；
  国内可走豆包 doubao-seedream / GLM cogview（均有 OpenAI 兼容或简单 REST）
- 视觉（读图）：william-jin-cmu/dsh-vision（默认智谱免费档）——可自动读教材扫描页，免人工转录
- OpenRouter 不适合本场景：以文本模型为主，无稳定 TTS/低价生图

## 推荐架构
```
资产生产（离线）           网站运行时（在线）
DSH + dsh-image-gen  ──►  生成 PNG/WebP ──►  git 提交到 public/ ──► 静态分发
（豆包/GLM 生图 API）                              孩子端零延迟、零成本
TTS：Web Speech（默认）──► 可选升级：server /api/tts 代理豆包（.env 加 VOLC_* 凭证）
```
- 原则：能离线生成的绝不运行时调 API（儿童产品：快、稳、省钱、内容可审）
- .env 规划：LLM 4 行（已有）+ 可选 IMAGE_API_*（豆包/GLM 生图）+ 可选 TTS_*（火山）
- 暂不引入运行时生图；语音输入（口语评测）等三年级英语听说关再议

## 2026-08-24 落地
- SSE 已默认启用：/api/hint/stream（服务端 chatStream 转发 LLM 流式增量，
  响应头 x-accel-buffering: no 免改 nginx），前端 Sprite 逐字呈现，失败自动回退 /api/hint JSON
- 资产管线就绪：scripts/gen-assets.mjs（豆包 doubao-seedream / 智谱 cogview-3-flash，
  IMAGE_PROVIDER + IMAGE_API_KEY 注入），43 个关卡 prompt 已按主题写好
- 前端已支持关卡插画：AdventureMap StageArt 组件探测 public/stages/<id>.jpg，存在即叠加显示
- 待办：用户提供豆包/GLM 生图 key 后跑批量生成
