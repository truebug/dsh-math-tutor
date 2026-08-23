import { createServer } from 'node:http'
import { config } from './config.ts'
import { buildReview, type ReviewRequest } from './routes/review.ts'

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function readBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/health') {
      json(res, 200, { ok: true })
      return
    }
    if (req.method === 'POST' && req.url === '/api/review') {
      const body = (await readBody(req)) as ReviewRequest
      if (!body || typeof body.total !== 'number' || !Array.isArray(body.wrongExamples)) {
        json(res, 400, { error: 'bad_request' })
        return
      }
      const text = await buildReview(body)
      json(res, 200, { text })
      return
    }
    json(res, 404, { error: 'not_found' })
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : 'internal_error' })
  }
})

server.listen(config.port, config.host, () => {
  console.log(`[server] listening on http://${config.host}:${config.port} (llm=${config.llm.provider}/${config.llm.model})`)
})
