import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 部署约束：base 支持子路径部署（如 /dsh-math-tutor/），由环境变量注入
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    proxy: {
      // 开发时把 /api 代理到本地后端；线上由 nginx 反代
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
})
