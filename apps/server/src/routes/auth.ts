// 家庭账号：昵称 + 6 位 PIN ↔ familyId + HMAC token
// 安全边界：familyId 不再是 bearer token；昵称索引只用于查存在性。
import { randomBytes } from 'node:crypto'
import type { ServerContext } from '../host.ts'
import { authGuard, recordAuthFailure, clearAuthFailures } from '../services/guard.ts'
import {
  authFamily, consumeSetupCode, getAccount, hashPin, importLegacyAccounts, normNick,
  putAccount, signToken, verifyPin,
} from '../services/auth.ts'

const PIN_RE = /^\d{6}$/
const NICK_RE = /^[\p{L}\p{N}_-]{1,20}$/u

export const name = 'auth'
export function apply(ctx: ServerContext) {
  const imported = importLegacyAccounts()
  if (imported > 0) console.log(`[auth] imported ${imported} legacy nickname(s), setup required`)

  const json = (res: import('node:http').ServerResponse, status: number, b: unknown, retryAfter?: number) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (retryAfter) headers['retry-after'] = String(retryAfter)
    res.writeHead(status, headers)
    res.end(JSON.stringify(b))
  }
  const guard = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, nick: string) => {
    const g = authGuard(req, nick)
    if (!g.ok) { json(res, 429, { error: 'rate_limited' }, g.retryAfter); return false }
    return true
  }

  // 注册新家庭：昵称 + 6 位 PIN。昵称唯一，冲突时前端引导走登录。
  ctx.routes.register('/api/auth/register', 'POST', async (req, res, _url, body) => {
    const b = body as { nickname?: string; pin?: string; consent?: boolean }
    const nick = normNick(b?.nickname ?? '')
    if (!NICK_RE.test(nick)) { json(res, 400, { error: 'bad_nickname' }); return true }
    if (!PIN_RE.test(b?.pin ?? '')) { json(res, 400, { error: 'pin_must_be_6_digits' }); return true }
    if (b?.consent !== true) { json(res, 403, { error: 'consent_required' }); return true }
    if (!guard(req, res, nick)) return true
    if (getAccount(nick)) { json(res, 409, { error: 'nickname_taken' }); return true }
    const familyId = `f-${randomBytes(6).toString('hex')}`
    const now = new Date().toISOString()
    putAccount(nick, { familyId, pin: hashPin(b.pin!), createdAt: now, updatedAt: now })
    json(res, 200, { familyId, token: signToken(familyId) })
    return true
  })

  // 登录：只认 scrypt PIN；旧档案（needsSetup）要求先走 /api/auth/setup
  ctx.routes.register('/api/auth/login', 'POST', async (req, res, _url, body) => {
    const b = body as { nickname?: string; pin?: string }
    const nick = normNick(b?.nickname ?? '')
    if (!NICK_RE.test(nick)) { json(res, 400, { error: 'bad_nickname' }); return true }
    if (!guard(req, res, nick)) return true
    const account = getAccount(nick)
    if (!account) { recordAuthFailure(req, nick); json(res, 404, { error: 'not_found' }); return true }
    if (account.needsSetup || !account.pin) { json(res, 403, { error: 'setup_required' }); return true }
    if (!verifyPin(b?.pin ?? '', account.pin)) {
      recordAuthFailure(req, nick)
      json(res, 403, { error: 'bad_pin' })
      return true
    }
    clearAuthFailures(req, nick)
    json(res, 200, { familyId: account.familyId, token: signToken(account.familyId) })
    return true
  })

  // 存在性查询：绝不返回 familyId
  ctx.routes.register('/api/auth/status', 'GET', async (_req, res, url) => {
    const nick = normNick(url.searchParams.get('nickname') ?? '')
    if (!NICK_RE.test(nick)) { json(res, 400, { error: 'bad_nickname' }); return true }
    const account = getAccount(nick)
    json(res, 200, {
      exists: !!account,
      hasPin: !!account?.pin,
      needsSetup: !!account?.needsSetup,
    })
    return true
  })

  // 旧档案迁移：一次性 setup code + 新 6 位 PIN
  ctx.routes.register('/api/auth/setup', 'POST', async (req, res, _url, body) => {
    const b = body as { nickname?: string; code?: string; pin?: string }
    const nick = normNick(b?.nickname ?? '')
    if (!NICK_RE.test(nick)) { json(res, 400, { error: 'bad_nickname' }); return true }
    if (!PIN_RE.test(b?.pin ?? '')) { json(res, 400, { error: 'pin_must_be_6_digits' }); return true }
    if (!guard(req, res, nick)) return true
    const account = getAccount(nick)
    if (!account) { json(res, 404, { error: 'not_found' }); return true }
    if (!consumeSetupCode(nick, (b?.code ?? '').trim())) {
      recordAuthFailure(req, nick)
      json(res, 403, { error: 'bad_setup_code' })
      return true
    }
    clearAuthFailures(req, nick)
    putAccount(nick, { ...account, pin: hashPin(b.pin!), needsSetup: false, updatedAt: new Date().toISOString() })
    json(res, 200, { familyId: account.familyId, token: signToken(account.familyId) })
    return true
  })

  // 轮换 token（token 泄露时用；旧 token 到期前仍有效，P1 再做吊销列表）
  ctx.routes.register('/api/auth/rotate', 'POST', async (req, res) => {
    const familyId = authFamily(req)
    if (!familyId) { json(res, 401, { error: 'unauthorized' }); return true }
    json(res, 200, { familyId, token: signToken(familyId) })
    return true
  })
}
