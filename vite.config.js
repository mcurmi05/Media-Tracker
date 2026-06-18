import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only middleware that mounts the /api/* serverless functions so
// `npm run dev` behaves like the Vercel deploy. Routes /api/<name> to
// the default export of /api/<name>.js.
const devApi = () => ({
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use('/api', async (req, res, next) => {
      const fullUrl = new URL(req.url, 'http://localhost')
      const name = fullUrl.pathname.replace(/^\/+/, '').split('/')[0]
      if (!name) return next()
      try {
        const { default: handler } = await server.ssrLoadModule(`/api/${name}.js`)
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
export default defineConfig(({ mode }) => {
  // Mirror Vercel: expose non-VITE_ env vars (e.g. IMDB_API_KEY) to the
  // dev API handlers through process.env. They are never bundled into the
  // client; only VITE_-prefixed vars are.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) {
    if (!(k in process.env)) process.env[k] = v
  }

  return {
    plugins: [react(), devApi()],
    // Bind to all interfaces so the dev server is reachable from other
    // devices on the LAN (e.g. testing on a phone at http://<your-ip>:5173).
    server: {
      host: true,
    },
    optimizeDeps: {
      exclude: ['chunk-3HWLUFA5', 'chunk-JSO3YDVX'],
    },
  }
})
