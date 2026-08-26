import { defineConfig, type ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const twseWwwHeaders: ProxyOptions['configure'] = (proxy) => {
  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.setHeader('Origin', 'https://www.twse.com.tw')
    proxyReq.setHeader('Referer', 'https://www.twse.com.tw/')
  })
}

const twStockProxy: Record<string, ProxyOptions> = {
  '/tw-stock/mis': {
    target: 'https://mis.twse.com.tw',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/tw-stock\/mis/, ''),
  },
  // 必須排在 /tw-stock/twse 之前，否則 startsWith 會把 twse-www 誤送到 openapi
  '/tw-stock/twse-www': {
    target: 'https://www.twse.com.tw',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/tw-stock\/twse-www/, ''),
    configure: twseWwwHeaders,
  },
  '/tw-stock/twse': {
    target: 'https://openapi.twse.com.tw',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/tw-stock\/twse/, ''),
  },
  '/tw-stock/tpex': {
    target: 'https://www.tpex.org.tw',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/tw-stock\/tpex/, ''),
  },
}

export default defineConfig({
  // GitHub Pages 專案站台路徑為 /bulletJournal/；本地開發仍用根路徑
  base: process.env.GITHUB_ACTIONS ? '/bulletJournal/' : '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: twStockProxy,
  },
  preview: {
    proxy: twStockProxy,
  },
})
