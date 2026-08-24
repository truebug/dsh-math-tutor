import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 部署约束：base 支持子路径部署（如 /dsh-math-tutor/），由环境变量注入
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/dsh-math-tutor/',  // 默认线上子路径；本地开发可 VITE_BASE_PATH=/ 覆盖
  plugins: [react()],
  resolve: {
    alias: {
      // 直接引用 DSH 插件的纯函数核心，浏览器端本地出题（零延迟、离线可用）
      '@dsh-math-tutor/math-generator/core': new URL(
        '../../packages/math-generator/src/core.ts', import.meta.url,
      ).pathname,
    },
  },
  server: {
    proxy: {
      // 开发时把 /api 代理到本地后端；线上由 nginx 反代
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
})
