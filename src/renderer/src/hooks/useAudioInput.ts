import { useEffect, useRef, useState } from 'react'

export interface AudioInput {
  /** Level of the loudest channel in dBFS (-Infinity when silent or unavailable), throttled for rendering. */
  levelDb: number
  /** Per-channel levels; two entries for a stereo interface (e.g. Scarlett input 1 / input 2). */
  channelDbs: number[]
  /** performance.now() of the last moment any channel was above the threshold. */
  lastAboveRef: React.RefObject<number>
  /** Set while the input can't be used; it keeps retrying in the background. */
  error: string | null
  devices: MediaDeviceInfo[]
}

const ANALYSIS_MS = 40 // ~= one 2048-sample window at 48kHz, so nothing falls between reads
const UI_MS = 80
const RETRY_MS = 3000
const MAX_CHANNELS = 2

function describeError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotReadableError' || name === 'AbortError')
    return 'The input is busy. Another app may have exclusive control of it'
  if (name === 'NotAllowedError') return 'Microphone access is blocked in Windows privacy settings'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No audio input found'
  return err instanceof Error ? err.message : String(err)
}

const rmsDb = (buf: Float32Array): number => {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return 20 * Math.log10(Math.sqrt(sum / buf.length))
}

/**
 * Opens an audio input and measures each channel's RMS level continuously; the
 * loudest channel counts, so a guitar on one side of a stereo interface reads at
 * full level whatever is (or isn't) on the other. If the input fails or drops
 * (unplugged, grabbed by another app) it retries every few seconds.
 *
 * Uses setInterval rather than requestAnimationFrame so it keeps going while the
 * window is hidden.
 */
export function useAudioInput(opts: {
  deviceId: string | undefined
  enabled: boolean
  thresholdDb: number
}): AudioInput {
  const { deviceId, enabled, thresholdDb } = opts
  const [channelDbs, setChannelDbs] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [attempt, setAttempt] = useState(0) // bump to reopen
  const lastAboveRef = useRef(-Infinity)
  const thresholdRef = useRef(thresholdDb)
  thresholdRef.current = thresholdDb

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let stream: MediaStream | undefined
    let ctx: AudioContext | undefined
    let timer: ReturnType<typeof setInterval> | undefined
    let retry: ReturnType<typeof setTimeout> | undefined

    const listDevices = async (): Promise<void> => {
      const all = await navigator.mediaDevices.enumerateDevices()
      if (!cancelled) setDevices(all.filter((d) => d.kind === 'audioinput'))
    }

    const fail = (err: unknown): void => {
      if (cancelled) return
      setError(describeError(err))
      setChannelDbs([])
      void listDevices()
      retry = setTimeout(() => setAttempt((a) => a + 1), RETRY_MS)
    }

    const open = (id: string | undefined): Promise<MediaStream> =>
      navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: id ? { exact: id } : undefined,
          channelCount: { ideal: MAX_CHANNELS },
          // raw signal: these would fight the level detection (and force mono)
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })

    ;(async () => {
      try {
        // A saved device that's unplugged falls back to the system default. A busy
        // device does NOT: that would silently measure the wrong input.
        const s = await open(deviceId).catch((err) =>
          deviceId && err instanceof DOMException && err.name === 'OverconstrainedError'
            ? open(undefined)
            : Promise.reject(err)
        )
        stream = s
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        const track = s.getAudioTracks()[0]
        track.addEventListener('ended', () => fail(new DOMException('ended', 'NotReadableError')))
        setError(null)
        await listDevices()

        ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(s)
        const channels = Math.min(MAX_CHANNELS, Math.max(1, track.getSettings().channelCount ?? 1))
        const splitter = ctx.createChannelSplitter(channels)
        source.connect(splitter)
        const analysers = Array.from({ length: channels }, (_, i) => {
          const a = ctx!.createAnalyser()
          a.fftSize = 2048
          splitter.connect(a, i)
          return a
        })
        const buf = new Float32Array(2048)
        let lastUi = 0

        timer = setInterval(() => {
          const dbs = analysers.map((a) => {
            a.getFloatTimeDomainData(buf)
            return rmsDb(buf)
          })
          const now = performance.now()
          if (Math.max(...dbs) > thresholdRef.current) lastAboveRef.current = now
          if (now - lastUi > UI_MS) {
            lastUi = now
            setChannelDbs(dbs)
          }
        }, ANALYSIS_MS)
      } catch (err) {
        fail(err)
      }
    })()

    // Plugging the interface back in should recover without waiting for the retry.
    const onDeviceChange = (): void => {
      void listDevices()
      if (!stream || stream.getAudioTracks()[0]?.readyState === 'ended') setAttempt((a) => a + 1)
    }
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange)

    return () => {
      cancelled = true
      clearInterval(timer)
      clearTimeout(retry)
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close()
      setChannelDbs([])
    }
  }, [deviceId, enabled, attempt])

  const levelDb = channelDbs.length ? Math.max(...channelDbs) : -Infinity
  return { levelDb, channelDbs, lastAboveRef, error, devices }
}
