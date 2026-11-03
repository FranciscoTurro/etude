let ctx: AudioContext | null = null

/** A loud three-note rising chime: "time's up, next exercise". */
export function playFinishChime(): void {
  ctx ??= new AudioContext()
  const c = ctx
  void c.resume()
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
