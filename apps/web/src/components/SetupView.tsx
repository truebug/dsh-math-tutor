import { useState } from 'react'
import { MODES, decodeRaceCode, encodeRaceCode, newSeed } from '../lib/raceCode'
import { LEVELS } from '@dsh-math-tutor/math-generator/core'
import type { Level } from '@dsh-math-tutor/math-generator/core'
import type { LearnerProfile, RaceSettings } from '../lib/types'

interface Props {
  profile: LearnerProfile
  settings: RaceSettings
  onChange: (s: RaceSettings) => void
  onStart: () => void
  onOpenMistakes: () => void
}

export default function SetupView({ profile, settings, onChange, onStart, onOpenMistakes }: Props) {
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')
  const preset = MODES[settings.mode]

  const importCode = () => {
    const decoded = decodeRaceCode(codeInput)
    if (!decoded) {
      setCodeError('竞赛码格式不正确（示例：G2A-L2-60-300-839201）')
      return
    }
    setCodeError('')
    onChange(decoded)
  }

  return (
    <div className="card">
      <h1>⚡ 速算挑战</h1>
      <p className="subtitle">你好，{profile.nickname}（{profile.grade} 年级）· {preset.label}</p>

      <div className="field">
        <label>题型</label>
        <div className="seg">
          {Object.entries(MODES).map(([id, m]) => (
            <button
              key={id}
              className={id === settings.mode ? 'seg-btn active' : 'seg-btn'}
              onClick={() => onChange({ ...settings, mode: id, max: m.max, ops: m.ops })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>难度</label>
        <div className="seg">
          {([1, 2, 3] as Level[]).map((lv) => (
            <button
              key={lv}
              className={lv === settings.level ? 'seg-btn active' : 'seg-btn'}
              onClick={() => onChange({ ...settings, level: lv })}
            >
              {'⭐'.repeat(lv)} {LEVELS[lv].label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>题量：{settings.count} 题</label>
        <input
          type="range" min={10} max={100} step={10} value={settings.count}
          onChange={(e) => onChange({ ...settings, count: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label>限时：{Math.floor(settings.durationSec / 60)} 分钟</label>
        <input
          type="range" min={60} max={900} step={60} value={settings.durationSec}
          onChange={(e) => onChange({ ...settings, durationSec: Number(e.target.value) })}
        />
      </div>

      <button className="primary big" onClick={onStart}>开始挑战 🚀</button>

      <button className="ghost" onClick={onOpenMistakes}>📒 错题本</button>

      <div className="race-code">
        <label>竞赛码（同码同题，可发给同学对战）</label>
        <div className="code-row">
          <code>{encodeRaceCode(settings)}</code>
          <button className="ghost" onClick={() => navigator.clipboard?.writeText(encodeRaceCode(settings))}>复制</button>
          <button className="ghost" onClick={() => onChange({ ...settings, seed: newSeed() })}>换一组</button>
        </div>
        <div className="code-row">
          <input
            placeholder="输入竞赛码加入同一组题"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
          />
          <button className="ghost" onClick={importCode}>导入</button>
        </div>
        {codeError && <p className="error">{codeError}</p>}
      </div>
    </div>
  )
}
