#!/usr/bin/env node
// 一次性迁移：把 data/profiles/*.json 全部导入 accounts.json（needsSetup=true）。
// 同名档案自动加 -2/-3 后缀，保证昵称唯一；familyId 原样保留，数据不动。
// 用法：node scripts/auth-import-legacy-profiles.mjs --data /var/lib/dsh-tutor/data
import { chownSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const dataDir = resolve(arg('--data', process.env.DATA_DIR ?? 'data'))
const accountsFile = join(dataDir, 'auth', 'accounts.json')
const profilesDir = join(dataDir, 'profiles')

const accounts = existsSync(accountsFile) ? JSON.parse(readFileSync(accountsFile, 'utf8')) : {}
const knownFamilyIds = new Set(Object.values(accounts).map((a) => a.familyId))
const norm = (n) => n.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 20)
const now = new Date().toISOString()
let added = 0

for (const file of readdirSync(profilesDir).filter((f) => f.endsWith('.json')).sort()) {
  const familyId = file.replace(/\.json$/, '')
  if (knownFamilyIds.has(familyId)) continue
  let nick = ''
  try { nick = JSON.parse(readFileSync(join(profilesDir, file), 'utf8'))?.profile?.nickname ?? '' } catch { /* ignore */ }
  const base = norm(nick) || `family-${familyId.slice(-6)}`
  let key = base
  for (let i = 2; accounts[key]; i++) key = `${base.slice(0, 17)}-${i}`
  accounts[key] = { familyId, needsSetup: true, createdAt: now, updatedAt: now }
  knownFamilyIds.add(familyId)
  added++
}

writeFileSync(accountsFile, JSON.stringify(accounts, null, 2), { mode: 0o600 })
try {
  const st = statSync(dataDir)
  if (process.getuid?.() === 0) chownSync(accountsFile, st.uid, st.gid)
} catch { /* ignore */ }
console.log(`[migrate] imported ${added} legacy profile(s); ${Object.keys(accounts).length} account(s) total`)
