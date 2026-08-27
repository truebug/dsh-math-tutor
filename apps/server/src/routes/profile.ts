// 画像云端存储：家庭 ID 即访问凭证（分享即授权，符合最小化原则）
// 存储：data/profiles/<familyId>.json（MVP 用 JSON 文件，后续可换 SQLite）
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const DIR = join(process.cwd(), 'data', 'profiles')
const NICK_FILE = join(process.cwd(), 'data', 'nicknames.json')

// ===== 昵称索引：昵称 → 绑定（familyId + 可选 PIN 哈希）=====
// 昵称是可绑定的展示属性，familyId(UUID) 才是数据主键；重名时冲突由用户选择合并/新开
interface NickEntry { familyId: string; pinHash?: string }
type NickIndex = Record<string, NickEntry>

function loadNicks(): NickIndex {
  if (!existsSync(NICK_FILE)) return {}
  try { return JSON.parse(readFileSync(NICK_FILE, 'utf8')) as NickIndex } catch { return {} }
}

function saveNicks(idx: NickIndex): void {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  writeFileSync(NICK_FILE, JSON.stringify(idx))
}

function normNick(n: string): string {
  return n.trim().toLowerCase().slice(0, 20)
}

function hashPin(pin: string): string {
  return createHash('sha256').update(`dsh-tutor-pin:${pin}`).digest('hex')
}

export interface ProfileDoc {
  version: 1
  consent: boolean
  profile: unknown        // LearnerProfile（昵称/年级等）
  profileData: unknown    // 确定性统计 + AI 点评历史
  adventure: unknown      // 星星/解锁/每日挑战
  sessions: unknown[]     // 练习记录（上限 200 条）
  updatedAt: string
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
  ctx.routes.register('/api/profile/*', 'GET', async (_req, res, url) => {
    const familyId = decodeURIComponent(url.pathname.split('/')[3] ?? '')
    if (!FAMILY_RE.test(familyId)) { json(res, 400, { error: 'bad_family_id' }); return true }
    const doc = loadProfile(familyId)
    doc ? json(res, 200, doc) : json(res, 404, { error: 'not_found' })
    return true
  })
  ctx.routes.register('/api/profile/*', 'PUT', async (_req, res, url, body) => {
    const familyId = decodeURIComponent(url.pathname.split('/')[3] ?? '')
    if (!FAMILY_RE.test(familyId)) { json(res, 400, { error: 'bad_family_id' }); return true }
    const doc = body as ProfileDoc
    if (!doc?.consent) { json(res, 403, { error: 'consent_required' }); return true }
    // 只接受白名单字段，防止任意写入
    saveProfile(familyId, {
      version: 1, consent: true,
      profile: doc.profile ?? null,
      profileData: doc.profileData ?? null,
      adventure: doc.adventure ?? null,
      sessions: Array.isArray(doc.sessions) ? doc.sessions.slice(0, 200) : [],
      updatedAt: '',
    })
    json(res, 200, { ok: true })
    return true
  })

  // 绑定昵称：开启同步时登记。同昵称已被他人绑定 → 409 冲突（前端弹选择）
  ctx.routes.register('/api/profile/claim-nickname', 'POST', async (_req, res, _url, body) => {
    const b = body as { nickname?: string; familyId?: string }
    const nick = normNick(b?.nickname ?? '')
    if (!nick || !b?.familyId || !FAMILY_RE.test(b.familyId)) { json(res, 400, { error: 'bad_request' }); return true }
    const idx = loadNicks()
    const existing = idx[nick]
    if (existing && existing.familyId !== b.familyId) {
      json(res, 409, { conflict: true, hasPin: !!existing.pinHash })
      return true
    }
    idx[nick] = { familyId: b.familyId, pinHash: existing?.pinHash }
    saveNicks(idx)
    json(res, 200, { ok: true, nickname: nick })
    return true
  })

  // 昵称解析（换设备找回）：昵称+PIN → familyId；PIN 错误 403，未设 PIN 直接放行
  ctx.routes.register('/api/profile/resolve-nickname', 'POST', async (_req, res, _url, body) => {
    const b = body as { nickname?: string; pin?: string }
    const nick = normNick(b?.nickname ?? '')
    if (!nick) { json(res, 400, { error: 'bad_request' }); return true }
    const entry = loadNicks()[nick]
    if (!entry) { json(res, 404, { error: 'not_found' }); return true }
    if (entry.pinHash && entry.pinHash !== hashPin(b?.pin ?? '')) {
      json(res, 403, { error: 'pin_required_or_wrong' })
      return true
    }
    json(res, 200, { familyId: entry.familyId })
    return true
  })

  // 设置/更新 PIN（可选，在看板设置；设置后换设备必须输码）
  ctx.routes.register('/api/profile/set-pin', 'POST', async (_req, res, _url, body) => {
    const b = body as { familyId?: string; nickname?: string; pin?: string }
    const nick = normNick(b?.nickname ?? '')
    if (!b?.familyId || !FAMILY_RE.test(b.familyId) || !nick) { json(res, 400, { error: 'bad_request' }); return true }
    const pin = (b.pin ?? '').trim()
    if (pin && !/^\d{4,6}$/.test(pin)) { json(res, 400, { error: 'pin_must_be_4_6_digits' }); return true }
    const idx = loadNicks()
    const entry = idx[nick]
    if (!entry || entry.familyId !== b.familyId) { json(res, 403, { error: 'not_bound' }); return true }
    idx[nick] = pin ? { ...entry, pinHash: hashPin(pin) } : { familyId: entry.familyId }  // 空 pin = 清除
    saveNicks(idx)
    json(res, 200, { ok: true, hasPin: !!pin })
    return true
  })
}
