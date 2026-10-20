// 云端同步：昵称 + 6 位 PIN ↔ familyId；API 访问用 HMAC token（存 localStorage，P0 决策）
// 仅在监护人同意后启用。familyId 本身不再具备访问权限。
import { loadProfile, loadSessions } from './storage'
import { loadAdventure } from './adventure'
import { loadProfileData } from './profile'

const FAMILY_KEY = 'dsh-math-tutor:family'
const TOKEN_KEY = 'dsh-math-tutor:token'
const LEARNER_KEY = 'dsh-math-tutor:learner'

// 匿名学习 ID：不依赖云同步/监护人同意，首次调用即生成。
// 用作 dsh 会话锚点，让未开同步的孩子也有连续记忆。
export function getLearnerId(): string {
  let id = localStorage.getItem(LEARNER_KEY)
  if (!id) {
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    id = 'l-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(LEARNER_KEY, id)
  }
  return id
}

export function getFamilyId(): string | null {
  return localStorage.getItem(FAMILY_KEY)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken()
  return token ? { ...extra, authorization: `Bearer ${token}` } : extra
}

// 兼容旧调用：新账号的 familyId 由服务端签发，这里只在本地留一个占位
export function newFamilyId(): string {
  const id = `f-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`
  localStorage.setItem(FAMILY_KEY, id)
  return id
}

export function setFamilyId(id: string): void {
  localStorage.setItem(FAMILY_KEY, id.trim().toLowerCase())
}

export function syncEnabled(): boolean {
  return getFamilyId() !== null && getToken() !== null
}

function payload() {
  return {
    version: 1 as const,
    consent: true,
    profile: loadProfile(),
    profileData: loadProfileData(),
    adventure: loadAdventure(),
    sessions: loadSessions(),
    updatedAt: '',
  }
}

// 全量上传（防抖 2s：练习结束/记星/画像更新后调用）
let timer: ReturnType<typeof setTimeout> | null = null
export function pushProfile(): void {
  const id = getFamilyId()
  if (!id) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/profile/${id}`, {
        method: 'PUT',
        headers: authHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify(payload()),
      })
      if (res.status === 401) console.warn('[sync] 登录已过期，请在成长看板重新验证设备')
    } catch { /* 离线时静默，下次再推 */ }
  }, 2000)
}

// 恢复：把云端数据写回本地（用于换设备）。token 由 login/setup 先行写入。
export async function pullProfile(familyId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/profile/${familyId}`, { headers: authHeaders() })
    if (!res.ok) return false
    const doc = await res.json()
    if (doc.profile) localStorage.setItem('dsh-math-tutor:profile', JSON.stringify(doc.profile))
    if (doc.profileData) localStorage.setItem('dsh-math-tutor:profile-data', JSON.stringify(doc.profileData))
    if (doc.adventure) localStorage.setItem('dsh-math-tutor:adventure', JSON.stringify(doc.adventure))
    if (Array.isArray(doc.sessions)) localStorage.setItem('dsh-math-tutor:sessions', JSON.stringify(doc.sessions))
    setFamilyId(familyId)
    return true
  } catch {
    return false
  }
}

export function disableSync(): void {
  localStorage.removeItem(FAMILY_KEY)
  localStorage.removeItem(TOKEN_KEY)
  // 仅本地停止同步；云端数据家长可联系管理员删除
}

// ===== 账号 =====
export type AuthResult =
  | { ok: true; familyId: string; token: string }
  | { ok: false; reason: 'conflict' | 'bad_pin' | 'not_found' | 'setup_required' | 'rate_limited' | 'bad_code' | 'error' }

async function postAuth(path: string, body: unknown): Promise<AuthResult> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = (await res.json()) as { familyId?: string; token?: string }
      if (!data.familyId || !data.token) return { ok: false, reason: 'error' }
      return { ok: true, familyId: data.familyId, token: data.token }
    }
    if (res.status === 409) return { ok: false, reason: 'conflict' }
    if (res.status === 429) return { ok: false, reason: 'rate_limited' }
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    if (err.error === 'setup_required') return { ok: false, reason: 'setup_required' }
    if (err.error === 'bad_pin') return { ok: false, reason: 'bad_pin' }
    if (err.error === 'bad_setup_code') return { ok: false, reason: 'bad_code' }
    if (err.error === 'not_found') return { ok: false, reason: 'not_found' }
    return { ok: false, reason: 'error' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export async function registerAccount(nickname: string, pin: string): Promise<AuthResult> {
  const r = await postAuth('/api/auth/register', { nickname, pin, consent: true })
  if (r.ok) { setFamilyId(r.familyId); setToken(r.token) }
  return r
}

export async function loginAccount(nickname: string, pin: string): Promise<AuthResult> {
  const r = await postAuth('/api/auth/login', { nickname, pin })
  if (r.ok) { setFamilyId(r.familyId); setToken(r.token) }
  return r
}

// 旧档案迁移：一次性 setup code + 新 6 位 PIN
export async function setupAccount(nickname: string, code: string, pin: string): Promise<AuthResult> {
  const r = await postAuth('/api/auth/setup', { nickname, code, pin })
  if (r.ok) { setFamilyId(r.familyId); setToken(r.token) }
  return r
}

export async function authStatus(nickname: string): Promise<{ exists: boolean; hasPin: boolean; needsSetup: boolean } | null> {
  try {
    const res = await fetch(`/api/auth/status?nickname=${encodeURIComponent(nickname)}`)
    if (!res.ok) return null
    return (await res.json()) as { exists: boolean; hasPin: boolean; needsSetup: boolean }
  } catch { return null }
}

// ===== 兼容旧调用 =====
export async function claimNickname(nickname: string, familyId: string): Promise<'ok' | 'conflict' | 'error'> {
  try {
    const res = await fetch('/api/profile/claim-nickname', {
      method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ nickname, familyId }),
    })
    if (res.status === 409) return 'conflict'
    return res.ok ? 'ok' : 'error'
  } catch { return 'error' }
}

export async function nicknameHasPin(nickname: string): Promise<boolean | null> {
  const s = await authStatus(nickname)
  if (!s) return null
  return s.hasPin
}

export async function resolveNickname(nickname: string, pin?: string): Promise<string | null> {
  const r = await loginAccount(nickname, pin ?? '')
  return r.ok ? r.familyId : null
}

export async function setNicknamePin(nickname: string, familyId: string, pin: string): Promise<'ok' | 'bad' | 'error'> {
  try {
    const res = await fetch('/api/profile/set-pin', {
      method: 'POST', headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ nickname, familyId, pin }),
    })
    if (res.ok) return 'ok'
    return res.status === 400 ? 'bad' : 'error'
  } catch { return 'error' }
}
