#!/usr/bin/env node
// 为 needsSetup 的旧档案生成一次性迁移码（默认 7 天有效）。
// 用法：node scripts/auth-issue-setup-codes.mjs --data /var/lib/dsh-tutor/data --out /root/dsh-setup-codes.txt
// 迁移码只以 sha256 落库；明文仅写入 --out 指定的 0600 文件。
import { createHash, randomBytes } from 'node:crypto'
import { chownSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const dataDir = resolve(arg('--data', process.env.DATA_DIR ?? 'data'))
const out = arg('--out', join(dataDir, 'auth', 'setup-codes.txt'))
const ttlDays = Number(arg('--days', '7'))
const authDir = join(dataDir, 'auth')
const accountsFile = join(authDir, 'accounts.json')
const codesFile = join(authDir, 'setup-codes.json')

// 脚本常以 root 运行，而服务以非 root 账号运行：写完后把属主对齐数据目录，
// 否则 0600 文件会让服务读不到（表现为 bad_setup_code / 登录 404）。
function ownAsDataDir(file) {
  try {
    const st = statSync(dataDir)
    if (process.getuid?.() === 0) chownSync(file, st.uid, st.gid)
  } catch { /* 权限不足时交给运维处理 */ }
}

const accounts = existsSync(accountsFile) ? JSON.parse(readFileSync(accountsFile, 'utf8')) : {}
const codes = existsSync(codesFile) ? JSON.parse(readFileSync(codesFile, 'utf8')) : {}
const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
const sha256 = (s) => createHash('sha256').update(s).digest('hex')

const targets = Object.entries(accounts).filter(([, a]) => a?.needsSetup)
if (targets.length === 0) { console.log('[setup] no legacy accounts need migration'); process.exit(0) }

mkdirSync(authDir, { recursive: true })
const lines = []
const expiresAt = Date.now() + ttlDays * 86400_000
for (const [nick, account] of targets) {
  let code = ''
  for (const b of randomBytes(8)) code += alphabet[b % alphabet.length]
  codes[nick] = { hash: sha256(code), expiresAt }
  lines.push(`${nick}\t${account.familyId}\t${code}`)
}
writeFileSync(codesFile, JSON.stringify(codes, null, 2), { mode: 0o600 })
writeFileSync(out, `# dsh-math-tutor 迁移码（${new Date().toISOString()} 生成，${ttlDays} 天有效，一次性）\n# 昵称\tfamilyId\t迁移码\n${lines.join('\n')}\n`, { mode: 0o600 })
ownAsDataDir(codesFile)
ownAsDataDir(out)
console.log(`[setup] issued ${lines.length} code(s) for: ${targets.map(([n]) => n).join(', ')}`)
console.log(`[setup] plaintext written to ${out} (mode 0600); codes are single-use`)
