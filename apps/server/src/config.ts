export const config = {
  // 部署约束：只监听回环地址，由 nginx 反代暴露；端口可配置
  host: process.env.SERVER_HOST ?? '127.0.0.1',
  port: Number(process.env.SERVER_PORT ?? 8787),
  // DeepSeek API Key 仅存在于服务端环境变量，前端永不接触
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
}
