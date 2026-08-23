import { createServer } from 'node:http'
import { config } from './config.ts'

const server = createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: 'not_found' }))
})

server.listen(config.port, config.host, () => {
  console.log(`[server] listening on http://${config.host}:${config.port}`)
})
