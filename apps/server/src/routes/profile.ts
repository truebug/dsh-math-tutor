// 画像云端存储：家庭 ID 即访问凭证（分享即授权，符合最小化原则）
// 存储：data/profiles/<familyId>.json（MVP 用 JSON 文件，后续可换 SQLite）
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'data', 'profiles')

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
}
