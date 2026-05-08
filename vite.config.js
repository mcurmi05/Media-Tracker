import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only middleware that mounts the /api/goodreads serverless function
// so `npm run dev` works the same as the Vercel deploy.
const goodreadsDevApi = () => ({
  name: 'goodreads-dev-api',
  configureServer(server) {
    server.middlewares.use('/api/goodreads', async (req, res) => {
      try {
        const { default: handler } = await server.ssrLoadModule('/api/goodreads.js')
        const fullUrl = new URL(req.url, 'http://localhost')
        req.query = Object.fromEntries(fullUrl.searchParams)
        const proxy = {
          status(code) { res.statusCode = code; return this },
          setHeader(k, v) { res.setHeader(k, v); return this },
          json(payload) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
          },
        }
        await handler(req, proxy)
      } catch (err) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Dev API error', details: err?.message }))
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), goodreadsDevApi()],
  optimizeDeps: {
    exclude: ['chunk-3HWLUFA5', 'chunk-JSO3YDVX']
  }
})

