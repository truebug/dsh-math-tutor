import { createServer } from 'node:http'
import { config } from './config.ts'
import { buildReview, type ReviewRequest } from './routes/review.ts'
import { getRoom, joinRoom, reportScore } from './routes/battle.ts'

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
    if (req.url?.startsWith('/api/battle/')) {
      const parts = req.url.split('/')
      const action = parts[3]
      const code = decodeURIComponent(parts[4] ?? '')
      if (req.method === 'POST' && action === 'join') {
        const { nickname } = (await readBody(req)) as { nickname?: string }
        if (!nickname) { json(res, 400, { error: 'nickname_required' }); return }
        json(res, 200, joinRoom(code, nickname.slice(0, 12)))
        return
      }
      if (req.method === 'POST' && action === 'score') {
        const b = (await readBody(req)) as { nickname?: string; correct?: number; answered?: number; usedMs?: number }
        if (!b.nickname || b.correct === undefined || b.answered === undefined || b.usedMs === undefined) {
          json(res, 400, { error: 'bad_request' }); return
        }
        const room = reportScore(code, b.nickname, b.correct, b.answered, b.usedMs)
        room ? json(res, 200, room) : json(res, 404, { error: 'not_in_room' })
        return
      }
      if (req.method === 'GET' && action === 'state') {
        const room = getRoom(code)
        room ? json(res, 200, room) : json(res, 404, { error: 'no_room' })
        return
      }
    }
    json(res, 404, { error: 'not_found' })
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : 'internal_error' })
  }
})

server.listen(config.port, config.host, () => {
  console.log(`[server] listening on http://${config.host}:${config.port} (llm=${config.llm.provider}/${config.llm.model})`)
})
