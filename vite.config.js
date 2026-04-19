import { defineConfig } from 'vite'

export default defineConfig({
  // Netlify の _redirects に対応するため base は '/' のまま
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  // 開発サーバーでの SPA フォールバック
  server: {
    port: 5173,
  },
})
