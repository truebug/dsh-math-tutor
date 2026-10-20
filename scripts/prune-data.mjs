#!/usr/bin/env node
// 数据保留：默认 dry-run；--apply 才真正删除/轮转。
// - 删除超过 --days 天的 DSH session 目录（每个 session 一个目录）
// - 轮转超过 --max-bytes 的埋点文件（*.1 覆盖上一份）
// 用法：node scripts/prune-data.mjs --data /var/lib/dsh-tutor/data --dsh-home /var/lib/dsh-tutor --apply
import { existsSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const apply = args.includes('--apply')
const days = Number(arg('--days', '30'))
const maxBytes = Number(arg('--max-bytes', String(1024 * 1024)))
const dataDir = resolve(arg('--data', process.env.DATA_DIR ?? 'data'))
const dshHome = resolve(arg('--dsh-home', process.env.DSH_HOME ?? ''))
const cutoff = Date.now() - days * 86400_000
const actions = []

// 1) DSH sessions: sessions/<workdir-slug>/<sessionId>/
const sessionsRoot = dshHome ? join(dshHome, 'sessions') : ''
if (sessionsRoot && existsSync(sessionsRoot)) {
  for (const slug of readdirSync(sessionsRoot)) {
    const slugDir = join(sessionsRoot, slug)
    let st
    try { st = statSync(slugDir) } catch { continue }
    if (!st.isDirectory()) continue
    for (const id of readdirSync(slugDir)) {
      const dir = join(slugDir, id)
      try {
        const s = statSync(dir)
        if (!s.isDirectory() || s.mtimeMs >= cutoff) continue
        actions.push({ op: 'rm -rf', path: dir })
        if (apply) rmSync(dir, { recursive: true, force: true })
      } catch { /* ignore */ }
    }
  }
}

// 2) 埋点轮转
for (const name of ['chat-metrics.jsonl', 'llm-metrics.jsonl', 'llm-usage.jsonl']) {
  const file = join(dataDir, name)
  if (!existsSync(file)) continue
  const size = statSync(file).size
  if (size < maxBytes) continue
  actions.push({ op: 'rotate', path: file, size })
  if (apply) {
    renameSync(file, `${file}.1`)
    writeFileSync(file, '')
  }
}

console.log(JSON.stringify({ apply, days, actions, total: actions.length }, null, 2))
if (!apply && actions.length > 0) console.log('[prune] dry-run：加 --apply 才会执行')
