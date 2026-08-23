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
