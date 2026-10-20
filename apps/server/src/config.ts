import { join } from 'node:path'

export const config = {
  // 部署约束：只监听回环地址，由 nginx 反代暴露；端口可配置
  host: process.env.SERVER_HOST ?? '127.0.0.1',
  port: Number(process.env.SERVER_PORT ?? 8787),
  // 运行期可写目录。systemd ProtectSystem=strict 下代码目录只读，
  // 只有 DATA_DIR 会通过 ReadWritePaths 放开；本地开发默认 ./data。
  dataDir: process.env.DATA_DIR ?? join(process.cwd(), 'data'),
  auth: {
    // token 签名密钥；为空时只能跑 shadow 模式
    secret: process.env.AUTH_SECRET ?? '',
    // 灰度：false 时只校验不拦截；前端全部带 token 后切 true
    enforce: (process.env.AUTH_ENFORCE ?? 'false') === 'true',
    ttlDays: Number(process.env.AUTH_TTL_DAYS ?? 30),
  },
  // 语音入口开关：默认关闭；上线告知文案并经回归后由 systemd 打开
  voiceEnabled: (process.env.VOICE_ENABLED ?? 'false') === 'true',
  // LLM 接入（OpenAI 兼容端点，换厂商只改 env；key 不出服务端）
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'deepseek',
    baseUrl: (process.env.LLM_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, ''),
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'deepseek-chat',
  },
  // 独立第二供应商（独立 key/配额）。未配置时熔断链只有主供应商，
  // deep health 会显式返回 fallback:"unconfigured"，不假装有兜底。
  fallback: {
    baseUrl: (process.env.LLM_FALLBACK_BASE_URL ?? '').replace(/\/$/, ''),
    apiKey: process.env.LLM_FALLBACK_API_KEY ?? '',
    model: process.env.LLM_FALLBACK_MODEL ?? '',
  },
}
