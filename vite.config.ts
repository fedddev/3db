import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import type { handleInterpret as Handler } from './server/interpret.ts'

// Serves the AI proxy at /api/interpret during development. The API key stays
// in this Node process (read from .env.local) and never reaches the browser.
function aiProxy(apiKey: string | undefined): Plugin {
  return {
    name: '3db-ai-proxy',
    configureServer(server) {
      server.middlewares.use('/api/interpret', async (req, res) => {
        const { handleInterpret } = (await server.ssrLoadModule('/server/interpret.ts')) as { handleInterpret: typeof Handler }
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const request = new Request('http://localhost/api/interpret', {
          method: req.method,
          headers: { 'content-type': 'application/json' },
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
        })
        const response = await handleInterpret(request, req.socket.remoteAddress ?? 'local', apiKey)
        res.statusCode = response.status
        res.setHeader('content-type', 'application/json')
        res.end(await response.text())
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), aiProxy(env.ANTHROPIC_API_KEY)] }
})
