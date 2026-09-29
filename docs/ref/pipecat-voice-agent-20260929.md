# Pipecat 拆解：语音 Agent 的帧管道架构（微信公众号文章归档）

> 来源：微信公众号（2026-09 前后），链接含 poc_token 已省略
> 归档目的：**网页端语音智能助手（小朋友直接对话）的候选技术方案**
> 关联：docs/roadmap-agent.md「语音对话助手」方向

## 核心架构思想

- **不依赖媒体服务器**：Pipecat（Daily 团队维护，BSD-2，1.5w+ stars）把传输层彻底抽象，
  LiveKit/Daily/Twilio/WebSocket/浏览器 P2P 只是可替换参数。同一份 bot.py 换参数即可切换
- **四词心智模型**：Frame（帧）/ FrameProcessor（处理器）/ Pipeline（管道）/ Transport（传输层）
- **打断是管道的结构属性**：InterruptionFrame（系统帧）穿过所有处理器，作废未播完音频和
  未生成完文本；SystemFrame 不受打断影响、DataFrame/ControlFrame 打断时清空
- **流式贯穿**：LLM 吐出第一句话 TTS 就开始合成，响应延迟可压到 1 秒内
- **轮次判断**：Silero VAD 判开口 + Smart Turn v3（语义+语调）判说完，不停纯静音时长，不抢话

## 工程要点

- 管道：transport.input → STT → user_agg → LLM → TTS → transport.output → assistant_agg
  （assistant_agg 放 output 后：只记录真正播出去的内容，打断的半句不进上下文）
- 函数调用：带类型注解+docstring 的 async 函数，自动生成 tool schema，跨 LLM 复用
- 调工具空窗：监听 on_function_calls_started 先垫一句「稍等，我查一下」
- 自定义 Processor 两条铁律：先调 super().process_frame()；不认识的帧原样下推
- 弃用：PipelineTask/PipelineRunner（1.3.0 起废弃）→ PipelineWorker/WorkerRunner

## 服务选型菜单（文章节选）

| 层 | 可选项 |
|---|---|
| STT | Deepgram、AssemblyAI、Azure、FunASR、Whisper、Soniox |
| LLM | OpenAI、Anthropic、Gemini、**DeepSeek**、Qwen、Groq、Ollama |
| TTS | Cartesia、ElevenLabs、MiniMax、Azure、Kokoro、Piper |
| 端到端语音 | OpenAI Realtime、Gemini Live、AWS Nova Sonic、Ultravox |
| 传输 | SmallWebRTC、Daily、LiveKit、WebSocket、Twilio、Telnyx |

完全离线组合：Ollama + 本地 Whisper + Piper（不出内网）。

## 周边

- Pipecat Flows（1.5.0 起并入主包）：多步骤结构化对话
- 客户端 SDK：JavaScript、React、React Native、Swift、Kotlin、C++、ESP32
- 调试：Whisker（帧流可视化）、Tail（终端仪表盘）；OpenTelemetry、Pipecat Cloud

## 与我们项目的关系

- **直接关联低**：当前是纯文本+Web Speech API 朗读，无双向实时语音需求
- **架构印证**：传输层抽象、业务逻辑不被基础设施锁死 = 我们 agent.ts 三层切分的同构思路
- **未来候选**：若做「网页语音对话小精灵」（孩子对 iPad 说话），Pipecat 是 Python 栈里
  最不绑厂商的选择，原生支持 DeepSeek 做 LLM 层；儿童场景重点评估：
  VAD/轮次判断对儿童语音（高音调、犹豫多）的适配、中文 STT 儿童语料质量、
  全程录音是否触及监护人同意红线
