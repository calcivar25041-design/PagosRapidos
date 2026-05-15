import { defineConfig } from 'vite'
import pages from '@hono/vite-cloudflare-pages'

export default defineConfig(() => {
  return {
    plugins: [pages()],
    build: {
      outDir: 'dist',
    }
  }
})
