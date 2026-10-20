// 家庭档案鉴权：HMAC 签名 token（无 session 表）+ scrypt PIN。
// 旧数据（nicknames.json 的 sha256 静态盐）不直接可用，必须经 setup code 重设 6 位 PIN。
import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { IncomingMessage } from 'node:http'
import { config } from '../config.ts'

const AUTH_DIR = join(config.dataDir, 'auth')
const ACCOUNTS_FILE = join(AUTH_DIR, 'accounts.json')
const CODES_FILE = join(AUTH_DIR, 'setup-codes.json')
const LEGACY_FILE = join(config.dataDir, 'nicknames.json')

export interface PinRecord { algo: 'scrypt'; salt: string; hash: string }
export interface Account {
  familyId: string
  pin?: PinRecord
  needsSetup?: boolean
  legacyPinHash?: string
  createdAt: string
  updatedAt: string
}
type AccountStore = Record<string, Account>

interface SetupCode { hash: string; expiresAt: number }
type CodeStore = Record<string, SetupCode>

export function normNick(n: string): string {
  return n.trim().toLowerCase().slice(0, 20)
}

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback
  try { return JSON.parse(readFileSync(file, 'utf8')) as T } catch { return fallback }
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 })
}

function loadAccounts(): AccountStore {
  return readJson<AccountStore>(ACCOUNTS_FILE, {})
}

function saveAccounts(store: AccountStore): void {
  writeJson(ACCOUNTS_FILE, store)
}

/** 把旧 nicknames.json 导入 accounts（幂等），旧账号一律要求 setup code 重设 PIN */
export function importLegacyAccounts(): number {
  const legacy = readJson<Record<string, { familyId: string; pinHash?: string }>>(LEGACY_FILE, {})
  const store = loadAccounts()
  let added = 0
  const now = new Date().toISOString()
  for (const [nick, entry] of Object.entries(legacy)) {
    const key = normNick(nick)
    if (!key || !entry?.familyId) continue
    if (store[key]) continue
    store[key] = {
      familyId: entry.familyId,
      needsSetup: true,
      legacyPinHash: entry.pinHash,
      createdAt: now,
      updatedAt: now,
    }
    added++
  }
  if (added > 0) saveAccounts(store)
  return added
}

export function getAccount(nickname: string): Account | null {
  return loadAccounts()[normNick(nickname)] ?? null
}

export function putAccount(nickname: string, account: Account): void {
  const store = loadAccounts()
  store[normNick(nickname)] = account
  saveAccounts(store)
}

export function hashPin(pin: string): PinRecord {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pin, salt, 32).toString('hex')
  return { algo: 'scrypt', salt, hash }
}

export function verifyPin(pin: string, rec: PinRecord): boolean {
  if (rec.algo !== 'scrypt' || !rec.salt || !rec.hash) return false
  const got = scryptSync(pin, rec.salt, 32)
  const want = Buffer.from(rec.hash, 'hex')
  return got.length === want.length && timingSafeEqual(got, want)
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

// ===== token =====
export function signToken(familyId: string): string {
  const secret = config.auth.secret
  if (!secret) return ''
  const exp = Math.floor(Date.now() / 1000) + config.auth.ttlDays * 86400
  const body = `v1.${familyId}.${exp}`
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken(token: string): { ok: boolean; familyId?: string; reason?: string } {
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') return { ok: false, reason: 'malformed' }
  const [, familyId, expRaw, sig] = parts
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return { ok: false, reason: 'expired' }
  const secret = config.auth.secret
  if (!secret) return { ok: false, reason: 'no_secret' }
  const want = createHmac('sha256', secret).update(`v1.${familyId}.${expRaw}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(want)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad_signature' }
  return { ok: true, familyId }
}

function bearer(req: IncomingMessage): string {
  const h = req.headers.authorization
  if (typeof h !== 'string') return ''
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return m ? m[1] : ''
}

/** 返回 token 对应的 familyId；无效返回 null */
export function authFamily(req: IncomingMessage): string | null {
  const v = verifyToken(bearer(req))
  return v.ok ? v.familyId ?? null : null
}

/**
 * 校验 token 与目标 familyId 一致。
 * AUTH_ENFORCE=false 时为 shadow 模式：只记录不拦截（用于灰度观察前端是否都带了 token）。
 */
export function requireAuth(req: IncomingMessage, familyId: string): boolean {
  const v = verifyToken(bearer(req))
  const ok = v.ok && v.familyId === familyId
  if (ok) return true
  if (!config.auth.enforce) {
    console.warn(`[auth] shadow: unauthenticated family=${familyId} reason=${v.reason ?? 'mismatch'}`)
    return true
  }
  return false
}

// ===== setup codes（旧档案一次性迁移）=====
export function issueSetupCode(nickname: string, ttlMs = 72 * 3600_000): string {
  const codes = readJson<CodeStore>(CODES_FILE, {})
  // 8 位、去掉易混字符
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let code = ''
  for (const byte of randomBytes(8)) code += alphabet[byte % alphabet.length]
  codes[normNick(nickname)] = { hash: sha256(code), expiresAt: Date.now() + ttlMs }
  writeJson(CODES_FILE, codes)
  return code
}

export function consumeSetupCode(nickname: string, code: string): boolean {
  const key = normNick(nickname)
  const codes = readJson<CodeStore>(CODES_FILE, {})
  const entry = codes[key]
  if (!entry || entry.expiresAt < Date.now()) return false
  const a = Buffer.from(sha256(code))
  const b = Buffer.from(entry.hash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  delete codes[key]
  writeJson(CODES_FILE, codes)
  return true
}

export function listSetupTargets(): string[] {
  return Object.keys(loadAccounts())
}
