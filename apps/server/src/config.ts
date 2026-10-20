import { join } from 'node:path'

export const config = {
  // 部署约束：只监听回环地址，由 nginx 反代暴露；端口可配置
  host: process.env.SERVER_HOST ?? '127.0.0.1',
  port: Number(process.env.SERVER_PORT ?? 8787),
  // 运行期可写目录。systemd ProtectSystem=strict 下代码目录只读，
  // 只有 DATA_DIR 会通过 ReadWritePaths 放开；本地开发默认 ./data。
  dataDir: process.env.DATA_DIR ?? join(process.cwd(), 'data'),
  // LLM 接入（OpenAI 兼容端点，换厂商只改 env；key 不出服务端）
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'deepseek',
    baseUrl: (process.env.LLM_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, ''),
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'deepseek-chat',
  },
}
