#!/usr/bin/env node
// DSH 冒烟：验证 sdk profile 能启动、两轮会话可复用，并量化 request/header。
// 用法（服务器）：
//   cd /opt/dsh-math-tutor/server
//   set -a; . ./.env; set +a
//   DSH_HOME=/tmp/dsh-smoke-home DSH_RUNTIME_DIR=$PWD/dsh-runtime \
//     /opt/node22/bin/node /path/to/dsh-smoke.mjs --patch $PWD/dsh-runtime/tutor.patch.yml
// 本地：
//   DSH_HOME=/tmp/dsh-smoke-home node scripts/dsh-smoke.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const runtimeDir = resolve(arg('--runtime', process.env.DSH_RUNTIME_DIR ?? 'apps/server/dsh-runtime'))
const patch = resolve(arg('--patch', join(runtimeDir, 'tutor.patch.yml')))
const home = resolve(arg('--home', process.env.DSH_HOME ?? '/tmp/dsh-smoke-home'))
const model = process.env.DSH_SMOKE_MODEL ?? process.env.LLM_MODEL ?? 'k3'
const provider = process.env.DSH_SMOKE_PROVIDER ?? 'deepseek-official'
const sessionId = `smoke-${Date.now().toString(36)}`

process.env.DSH_HOME = home
process.env.DSH_PERMISSION_MODE ??= 'read-only'

const clientUrl = pathToFileURL(join(runtimeDir, 'node_modules/@deepseek-ai/dsh-sdk-client/lib/index.js')).href
const { DeepSeekHarness } = await import(clientUrl)

function findSessionFile(id) {
  const root = join(home, 'sessions')
  const hits = []
  const walk = (dir, depth = 0) => {
    if (depth > 4) return
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      let st
      try { st = statSync(p) } catch { continue }
      if (st.isDirectory()) walk(p, depth + 1)
      else if (name === 'session.v3.jsonl.zstd') hits.push({ p, mtime: st.mtimeMs })
    }
  }
  try { walk(root) } catch { return null }
  const byId = hits.find((h) => h.p.includes(id))
  if (byId) return byId.p
  return hits.sort((a, b) => b.mtime - a.mtime)[0]?.p ?? null
}

function inspect(file) {
  if (!file) return { headerBytes: null, toolsCount: null, error: 'session_log_not_found' }
  try {
    let text
    try {
      // session 日志是多帧 zstd 追加；Node 的 zstdDecompressSync 可能只读第一帧。
      text = execFileSync('zstd', ['-dc', file], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
    } catch {
      text = zstdDecompressSync(readFileSync(file)).toString('utf8')
    }
    const line = text.split('\n').find((l) => l.startsWith('{"type":"request/header"'))
    if (!line) return { headerBytes: null, toolsCount: null, error: 'request_header_not_found' }
    const parsed = JSON.parse(line)
    const tools = parsed?.data?.header?.tools
    // tools 为空时上游会省略该字段（而不是给 []），缺失即视为 0。
    const toolsCount = Array.isArray(tools) ? tools.length : 0
    return { headerBytes: Buffer.byteLength(line), toolsCount, toolsField: Array.isArray(tools) ? 'array' : 'absent', file }
  } catch (e) {
    return { headerBytes: null, toolsCount: null, error: e instanceof Error ? e.message : String(e) }
  }
}

const harness = new DeepSeekHarness({
  profile: 'sdk',
  patches: [patch],
  provider,
  model,
  maxTokens: 256,
  env: process.env,
})

const t0 = performance.now()
try {
  const first = await harness.run('用一句话解释 7+8=15 里的进位。', { sessionId })
  const t1 = performance.now()
  const second = await harness.run('刚才那道题的算式是什么？只回答算式。', { sessionId })
  const t2 = performance.now()

  const file = findSessionFile(sessionId)
  const info = inspect(file)
  console.log(JSON.stringify({
    sessionId,
    firstMs: Math.round(t1 - t0),
    secondMs: Math.round(t2 - t1),
    first: (first.finalResponse ?? '').slice(0, 160),
    second: (second.finalResponse ?? '').slice(0, 160),
    ...info,
  }, null, 2))

  // 模型回复不参与判定：配额耗尽时 finalResponse 为空属预期。
  const ok = info.toolsCount === 0 && typeof info.headerBytes === 'number' && info.headerBytes < 2048
  if (!ok) {
    console.error(`[smoke] FAIL: toolsCount=${info.toolsCount} headerBytes=${info.headerBytes} (${info.error ?? ''})`)
    process.exitCode = 1
  } else {
    console.log('[smoke] OK: tool surface closed, header < 2KB')
  }
} catch (e) {
  console.error('[smoke] ERROR:', e instanceof Error ? e.message : e)
  process.exitCode = 1
} finally {
  await harness.close().catch(() => {})
}
