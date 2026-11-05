let ctx: AudioContext | null = null

/** One output context for everything the app plays (chime, metronome). */
export function audioOut(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** A loud three-note rising chime: "time's up, next exercise". */
export function playFinishChime(): void {
  const c = audioOut()
  const start = c.currentTime + 0.02
  ;[660, 880, 1320].forEach((freq, i) => {
    const t = start + i * 0.18
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.6, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, t + (i === 2 ? 1.2 : 0.4))
    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + 1.3)
  })
}

// Clicks share one gain, so a volume change also reaches the ones already scheduled.
let clickBus: GainNode | null = null
let clickLevel = 1

/** `volume` is 0–100; squared so the slider feels even to the ear. */
export function setClickVolume(volume: number): void {
  clickLevel = (volume / 100) ** 2
  if (clickBus) clickBus.gain.value = clickLevel
}

/** A short, sharp click scheduled at audio time `t`. */
export function scheduleClick(t: number): void {
  const c = audioOut()
  if (!clickBus) {
    clickBus = c.createGain()
    clickBus.gain.value = clickLevel
    clickBus.connect(c.destination)
  }
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'square'
  osc.frequency.value = 1500
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(1, t + 0.001)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
  osc.connect(gain).connect(clickBus)
  osc.start(t)
  osc.stop(t + 0.05)
}
