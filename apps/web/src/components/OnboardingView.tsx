import { useState } from 'react'
import type { Gender, LearnerProfile, Subject } from '../lib/types'

interface Props {
  onDone: (p: LearnerProfile) => void
}

const GENDERS: Array<{ id: Gender; label: string }> = [
  { id: 'boy', label: '👦 男生' },
  { id: 'girl', label: '👧 女生' },
  { id: 'secret', label: '🤫 保密' },
]

const SUBJECTS: Array<{ id: Subject; label: string }> = [
  { id: 'math', label: '🔢 数学' },
  { id: 'chinese', label: '📖 语文' },
  { id: 'english', label: '🔤 英语' },
]

export default function OnboardingView({ onDone }: Props) {
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState<Gender>('secret')
  const [age, setAge] = useState(8)
  const [grade, setGrade] = useState<2 | 3 | 4 | 5>(2)
  const [subjects, setSubjects] = useState<Subject[]>(['math'])
  const [error, setError] = useState('')

  const toggleSubject = (s: Subject) => {
    setSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    )
  }

  const submit = () => {
    if (nickname.trim().length === 0) {
      setError('给自己起个昵称吧～')
      return
    }
    if (subjects.length === 0) {
      setError('至少选一个科目哦')
      return
    }
    onDone({
      nickname: nickname.trim().slice(0, 12),
      gender,
      age,
      grade,
      subjects,
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <div className="card">
      <h1>👋 你好呀！</h1>
      <p className="subtitle">先认识一下，这样练习记录才是你的专属档案</p>

      <div className="field">
        <label>我的昵称</label>
        <input
          className="text-input"
          placeholder="比如：小算手"
          value={nickname}
          maxLength={12}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      <div className="field">
        <label>性别</label>
        <div className="seg">
          {GENDERS.map((g) => (
            <button
              key={g.id}
              className={gender === g.id ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setGender(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>年龄：{age} 岁</label>
        <input type="range" min={6} max={13} value={age} onChange={(e) => setAge(Number(e.target.value))} />
      </div>

      <div className="field">
        <label>年级</label>
        <div className="seg">
          {([2, 3, 4, 5] as const).map((g) => (
            <button
              key={g}
              className={grade === g ? 'seg-btn active' : 'seg-btn'}
              disabled={g !== 2}
              onClick={() => setGrade(g)}
              title={g !== 2 ? '内容筹备中，敬请期待' : undefined}
            >
              {g} 年级{g !== 2 ? ' 🔒' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>想练的科目（可多选）</label>
        <div className="seg">
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              className={subjects.includes(s.id) ? 'seg-btn active' : 'seg-btn'}
              onClick={() => toggleSubject(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      <button className="primary big" onClick={submit}>开始我的练习之旅 🚀</button>
      <p className="privacy">信息仅保存在这台设备的浏览器里，不会上传。</p>
    </div>
  )
}
