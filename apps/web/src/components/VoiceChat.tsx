// 语音对话小精灵：长按说话 → 浏览器内语音识别 → 文字发 /api/chat → TTS 朗读回复
// 隐私红线：音频不出设备（识别在浏览器内完成），只上传转写文本
// 降级：不支持语音识别的浏览器自动切换为文字输入
import { useState, useRef } from 'react'
import { getFamilyId, syncEnabled } from '../lib/sync'

interface Props { grade: 2 | 3 | 4 | 5 }

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((ev: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
const SR: (new () => SpeechRecognitionLike) | undefined =
  (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
  ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition

// 复用 RaceView 的朗读模式：zh-CN、rate 0.85、cancel 防重叠
function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'zh-CN'
  utt.rate = 0.85
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utt)
}

export default function VoiceChat({ grade }: Props) {
  const [open, setOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [textInput, setTextInput] = useState('')
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const voiceOk = !!SR

  const send = async (message: string) => {
    if (!message.trim() || busy) return
    setBusy(true)
    setReply('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          grade,
          message,
          familyId: syncEnabled() ? getFamilyId() ?? undefined : undefined,
        }),
        signal: AbortSignal.timeout(60_000),
      })
      const data = (await res.json()) as { text?: string }
      const text = data.text ?? '小精灵刚才走神了，再说一次好吗？'
      setReply(text)
      speak(text)
    } catch {
      setReply('小精灵累了，稍后再聊吧～')
    }
    setBusy(false)
  }

  const startListen = () => {
    if (!SR || listening || busy) return
    const rec = new SR()
    rec.lang = 'zh-CN'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (ev) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i]
        if (r.isFinal) final += r[0].transcript
        else interim += r[0].transcript
      }
      setHeard(final || interim)
      if (final) void send(final)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec
    setHeard('')
    setReply('')
    setListening(true)
    rec.start()
  }

  const stopListen = () => {
    if (recRef.current && listening) recRef.current.stop()
    setListening(false)
  }

  if (!open) {
    return (
      <button className="voice-fab" aria-label="和小精灵说话" onClick={() => setOpen(true)} title="和小精灵说话">
        🎤
      </button>
    )
  }

  return (
    <div className="voice-panel">
      <div className="voice-head">
        <span>和小精灵说话</span>
        <button className="voice-close" onClick={() => { stopListen(); setOpen(false) }} aria-label="关闭">✕</button>
      </div>
      {voiceOk ? (
        <button
          className={`voice-mic${listening ? ' listening' : ''}`}
          onPointerDown={startListen}
          onPointerUp={stopListen}
          onPointerCancel={stopListen}
          onPointerLeave={stopListen}
          disabled={busy}
        >
          {busy ? '小精灵思考中…' : listening ? '正在听…松开发送' : '按住说话'}
        </button>
      ) : (
        <p className="voice-note">这个浏览器不支持语音输入，打字也可以哦</p>
      )}
      <form className="voice-text" onSubmit={(e) => { e.preventDefault(); void send(textInput); setTextInput('') }}>
        <input value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="也可以打字…" maxLength={200} />
        <button type="submit" disabled={busy || !textInput.trim()}>发送</button>
      </form>
      {heard && <p className="voice-heard">你说：{heard}</p>}
      {reply && <p className="voice-reply">🧚 {reply}</p>}
      <p className="voice-note">语音只在这台设备上听，不会上传哦</p>
    </div>
  )
}
