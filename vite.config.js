import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/neis': {
        target: 'https://open.neis.go.kr',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/neis/, '/hub/schoolInfo'),
      },
    },
  },
})
