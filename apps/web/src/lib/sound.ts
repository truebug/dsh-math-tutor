// WebAudio 轻量音效：无需音频文件，儿童友好的温和音调
let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, ms: number, gain = 0.08, type: OscillatorType = 'sine', delay = 0) {
  const a = ac()
  if (!a) return
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(gain, a.currentTime + delay)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + delay + ms / 1000)
  osc.connect(g).connect(a.destination)
  osc.start(a.currentTime + delay)
  osc.stop(a.currentTime + delay + ms / 1000)
}

export const sfx = {
  correct: () => { tone(880, 90); tone(1320, 120, 0.08, 'sine', 0.08) },
  wrong: () => { tone(240, 180, 0.05, 'triangle') },
  streak: () => { tone(660, 80); tone(880, 80, 0.08, 'sine', 0.07); tone(1100, 140, 0.09, 'sine', 0.14) },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 160, 0.09, 'sine', i * 0.13)) },
}
