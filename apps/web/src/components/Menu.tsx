import { useEffect, useRef, useState } from 'react'
import type { View } from '../lib/types'

interface Props {
  current: View
  onNavigate: (v: View) => void
}

const ITEMS: Array<{ view: View; label: string }> = [
  { view: 'map', label: '🗺️ 寻宝地图' },
  { view: 'setup', label: '⚡ 自由练习' },
  { view: 'dashboard', label: '📊 成长看板' },
  { view: 'mistakes', label: '📒 错题本' },
]

export default function Menu({ current, onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  return (
    <div className="menu" ref={ref}>
      <button className="menu-btn" aria-label="菜单" onClick={() => setOpen(!open)}>⋯</button>
      {open && (
        <div className="menu-list">
          {ITEMS.map((it) => (
            <button
              key={it.view}
              className={it.view === current ? 'menu-item active' : 'menu-item'}
              onClick={() => { setOpen(false); onNavigate(it.view) }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
