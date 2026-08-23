// 云端同步：家庭 ID 即访问凭证；仅在监护人同意后启用
import { loadProfile, loadSessions } from './storage'
import { loadAdventure } from './adventure'
import { loadProfileData } from './profile'

const FAMILY_KEY = 'dsh-math-tutor:family'

export function getFamilyId(): string | null {
  return localStorage.getItem(FAMILY_KEY)
}

export function newFamilyId(): string {
  const id = `f-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`
  localStorage.setItem(FAMILY_KEY, id)
  return id
}

export function setFamilyId(id: string): void {
  localStorage.setItem(FAMILY_KEY, id.trim().toLowerCase())
}

export function syncEnabled(): boolean {
  return getFamilyId() !== null
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
      await fetch(`/api/profile/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload()),
      })
    } catch { /* 离线时静默，下次再推 */ }
  }, 2000)
}

// 恢复：把云端数据写回本地（用于换设备）
export async function pullProfile(familyId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/profile/${familyId}`)
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
  localStorage.removeItem(FAMILY_KEY)  // 仅本地停止同步；云端数据家长可联系管理员删除
}
