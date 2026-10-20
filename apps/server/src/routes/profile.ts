// 画像云端存储：家庭 ID 即访问凭证（分享即授权，符合最小化原则）
// 存储：data/profiles/<familyId>.json（MVP 用 JSON 文件，后续可换 SQLite）
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { config } from '../config.ts'
import { getAccount, hashPin, putAccount, requireAuth } from '../services/auth.ts'

const DIR = join(config.dataDir, 'profiles')
const NICK_FILE = join(config.dataDir, 'nicknames.json')

// ===== 昵称索引：昵称 → 绑定（familyId + 可选 PIN 哈希）=====
// 昵称是可绑定的展示属性，familyId(UUID) 才是数据主键；重名时冲突由用户选择合并/新开
interface NickEntry { familyId: string; pinHash?: string }
type NickIndex = Record<string, NickEntry>

function loadNicks(): NickIndex {
  if (!existsSync(NICK_FILE)) return {}
  try { return JSON.parse(readFileSync(NICK_FILE, 'utf8')) as NickIndex } catch { return {} }
}

function saveNicks(idx: NickIndex): void {
  mkdirSync(config.dataDir, { recursive: true })
  writeFileSync(NICK_FILE, JSON.stringify(idx))
}

function normNick(n: string): string {
  return n.trim().toLowerCase().slice(0, 20)
}

export interface ProfileDoc {
  version: 1
  consent: boolean
  profile: unknown        // LearnerProfile（昵称/年级等）
  profileData: unknown    // 确定性统计 + AI 点评历史
  adventure: unknown      // 星星/解锁/每日挑战
  sessions: unknown[]     // 练习记录（上限 200 条）
  goal?: GoalDoc | null    // 周目标（agent 主动推进用）
  updatedAt: string
}

export interface GoalDoc {
  kind: 'accuracy' | 'count'   // 正确率目标 / 题量目标
  target: number                // accuracy: 0-100；count: 题数
  label: string                 // 展示文本（如「进退位正确率到 85%」）
  weekStart: string             // ISO 日期（周一）
  createdAt: string
}

export function loadProfile(familyId: string): ProfileDoc | null {
  const file = join(DIR, `${familyId}.json`)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as ProfileDoc
  } catch {
    return null
  }
}

export function saveProfile(familyId: string, doc: ProfileDoc): void {
  mkdirSync(DIR, { recursive: true })
  doc.updatedAt = new Date().toISOString()
  writeFileSync(join(DIR, `${familyId}.json`), JSON.stringify(doc))
}

// ===== DSH 插件壳 =====
import type { ServerContext } from '../host.ts'
const FAMILY_RE = /^[a-z0-9-]{6,32}$/
export const name = 'profile'
export function apply(ctx: ServerContext) {
  const json = (res: import('node:http').ServerResponse, status: number, b: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(b))
  }
  // 周目标：设置/查询（必须在 /api/profile/* 通配符之前注册，否则被先匹配）
  ctx.routes.register('/api/profile/goal', 'POST', async (req, res, _url, body) => {
    const b = body as { familyId?: string; goal?: GoalDoc | null }
    if (!b?.familyId || !FAMILY_RE.test(b.familyId)) { json(res, 400, { error: 'bad_request' }); return true }
    if (!requireAuth(req, b.familyId)) { json(res, 401, { error: 'unauthorized' }); return true }
    const doc = loadProfile(b.familyId)
    if (!doc) { json(res, 404, { error: 'not_found' }); return true }
    doc.goal = b.goal ?? null
    saveProfile(b.familyId, doc)
    json(res, 200, { ok: true })
    return true
  })
  ctx.routes.register('/api/profile/goal', 'GET', async (req, res, url) => {
    const familyId = url.searchParams.get('familyId') ?? ''
    if (!FAMILY_RE.test(familyId)) { json(res, 400, { error: 'bad_family_id' }); return true }
    if (!requireAuth(req, familyId)) { json(res, 401, { error: 'unauthorized' }); return true }
    const doc = loadProfile(familyId)
    doc?.goal ? json(res, 200, doc.goal) : json(res, 404, { error: 'no_goal' })
    return true
  })

  ctx.routes.register('/api/profile/*', 'GET', async (req, res, url) => {
    const familyId = decodeURIComponent(url.pathname.split('/')[3] ?? '')
    if (!FAMILY_RE.test(familyId)) { json(res, 400, { error: 'bad_family_id' }); return true }
    if (!requireAuth(req, familyId)) { json(res, 401, { error: 'unauthorized' }); return true }
    const doc = loadProfile(familyId)
    doc ? json(res, 200, doc) : json(res, 404, { error: 'not_found' })
    return true
  })
  ctx.routes.register('/api/profile/*', 'PUT', async (req, res, url, body) => {
    const familyId = decodeURIComponent(url.pathname.split('/')[3] ?? '')
    if (!FAMILY_RE.test(familyId)) { json(res, 400, { error: 'bad_family_id' }); return true }
    if (!requireAuth(req, familyId)) { json(res, 401, { error: 'unauthorized' }); return true }
    const doc = body as ProfileDoc
    if (!doc?.consent) { json(res, 403, { error: 'consent_required' }); return true }
    // 只接受白名单字段，防止任意写入
    saveProfile(familyId, {
      version: 1, consent: true,
      profile: doc.profile ?? null,
      profileData: doc.profileData ?? null,
      adventure: doc.adventure ?? null,
      sessions: Array.isArray(doc.sessions) ? doc.sessions.slice(0, 200) : [],
      goal: doc.goal ?? null,
      updatedAt: '',
    })
    json(res, 200, { ok: true })
    return true
  })

  // 绑定昵称：开启同步时登记。同昵称已被他人绑定 → 409 冲突（前端弹选择）
  ctx.routes.register('/api/profile/claim-nickname', 'POST', async (req, res, _url, body) => {
    const b = body as { nickname?: string; familyId?: string }
    const nick = normNick(b?.nickname ?? '')
    if (!nick || !b?.familyId || !FAMILY_RE.test(b.familyId)) { json(res, 400, { error: 'bad_request' }); return true }
    if (!requireAuth(req, b.familyId)) { json(res, 401, { error: 'unauthorized' }); return true }
    const idx = loadNicks()
    const existing = idx[nick]
    if (existing && existing.familyId !== b.familyId) {
      json(res, 409, { conflict: true, hasPin: !!existing.pinHash })
      return true
    }
    idx[nick] = { familyId: b.familyId, pinHash: existing?.pinHash }
    saveNicks(idx)
    // accounts.json 是登录的唯一事实来源；这里补齐索引（PIN 由 set-pin 设置）
    if (!getAccount(nick)) {
      const now = new Date().toISOString()
      putAccount(nick, { familyId: b.familyId, needsSetup: true, createdAt: now, updatedAt: now })
    }
    json(res, 200, { ok: true, nickname: nick })
    return true
  })

  // 昵称存在性查询：只回 exists/hasPin，绝不回 familyId（familyId 不再当 bearer token）
  ctx.routes.register('/api/profile/resolve-nickname', 'POST', async (_req, res, _url, body) => {
    const b = body as { nickname?: string }
    const nick = normNick(b?.nickname ?? '')
    if (!nick) { json(res, 400, { error: 'bad_request' }); return true }
    const entry = loadNicks()[nick]
    if (!entry) { json(res, 404, { error: 'not_found' }); return true }
    json(res, 200, { exists: true, hasPin: !!entry.pinHash })
    return true
  })

  // 设置/更新 PIN（可选，在看板设置；设置后换设备必须输码）
  ctx.routes.register('/api/profile/set-pin', 'POST', async (req, res, _url, body) => {
    const b = body as { familyId?: string; nickname?: string; pin?: string }
    const nick = normNick(b?.nickname ?? '')
    if (!b?.familyId || !FAMILY_RE.test(b.familyId) || !nick) { json(res, 400, { error: 'bad_request' }); return true }
    if (!requireAuth(req, b.familyId)) { json(res, 401, { error: 'unauthorized' }); return true }
    const pin = (b.pin ?? '').trim()
    if (pin && !/^\d{6}$/.test(pin)) { json(res, 400, { error: 'pin_must_be_6_digits' }); return true }
    const idx = loadNicks()
    const account = getAccount(nick)
    if (!account || account.familyId !== b.familyId) { json(res, 403, { error: 'not_bound' }); return true }
    // 空 pin = 清除（账号保留，但下次恢复需重新 setup）
    putAccount(nick, {
      ...account,
      pin: pin ? hashPin(pin) : undefined,
      needsSetup: !pin,
      updatedAt: new Date().toISOString(),
    })
    // 旧索引只保留 familyId，旧 sha256 PIN 不再写入
    idx[nick] = { familyId: account.familyId }
    saveNicks(idx)
    json(res, 200, { ok: true, hasPin: !!pin })
    return true
  })

}
