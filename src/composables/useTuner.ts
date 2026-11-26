import { computed, onScopeDispose, reactive } from 'vue'
import { ANALYSER_SIZE, acquireMic, micErrorMessage, releaseMic, type MicHandle } from '@/audio/audioEngine'
import { analyzeFreq, noteName, type NoteName } from '@/audio/music'
import { Pitch } from '@/audio/pitch'
import { meterPosition, median, nearestMarking, rms, toDb, type Marking } from '@/audio/dynamics'
import { useSettings } from '@/stores/settings'
import { useSession } from '@/stores/session'

/** Minimum clarity for a frame to count as a pitched note. */
export const MIN_CLARITY = 0.9
/** Frames quieter than this are ignored as silence/noise. */
export const NOISE_GATE_DB = -60
/** How long to keep showing the last note after the sound stops. */
const HOLD_MS = 400
const SMOOTH_FRAMES = 5

export interface TunerFrame {
  time: number
  freq: number
  clarity: number
  db: number
  voiced: boolean
}

export interface TunerState {
  running: boolean
  error: string | null
  /** True while a clear pitch is (recently) detected. */
  hasPitch: boolean
  /** Smoothed frequency in Hz. */
  freq: number
  /** Nearest concert MIDI note. */
  midi: number
  cents: number
  note: NoteName | null
  /** How long (ms) the current note has been held steadily. */
  stableMs: number
  /** Smoothed level in dBFS. */
  db: number
  /** dB relative to the calibrated mf, or null if uncalibrated. */
  dbRelMf: number | null
  marking: Marking | null
  /** 0..1 position on the dynamic meter, or null if uncalibrated. */
  meterPos: number | null
}

export type Tuner = TunerState & {
  start(): Promise<void>
  stop(): void
  /** Subscribe to raw per-frame data. Returns an unsubscribe function. */
  onFrame(cb: (f: TunerFrame) => void): () => void
}

/**
 * Live pitch + dynamics detection from the shared microphone.
 * Reusable from any screen; stops automatically when the owning scope is disposed.
 */
export function useTuner(): Tuner {
  const settingsStore = useSettings()
  const settings = settingsStore.settings
  const session = useSession()

  let mic: MicHandle | null = null
  let raf = 0
  let detector: Pitch | null = null
  const buf = new Float32Array(ANALYSER_SIZE)
  const recentFreqs: number[] = []
  const listeners = new Set<(f: TunerFrame) => void>()
  let lastVoicedAt = 0
  let stableSince = 0
  let stableMidi = -1
  let starting = false
  let disposed = false

  const state: Tuner = reactive({
    running: false,
    error: null as string | null,
    hasPitch: false,
    freq: 0,
    midi: 0,
    cents: 0,
    stableMs: 0,
    db: -100,
    note: computed(() => (state.freq > 0 ? noteName(state.midi, settingsStore.nameOptions) : null)),
    dbRelMf: computed(() => (session.mfDb == null ? null : state.db - session.mfDb)),
    marking: computed(() =>
      state.dbRelMf == null || state.db <= NOISE_GATE_DB ? null : nearestMarking(state.dbRelMf),
    ),
    meterPos: computed(() => (state.dbRelMf == null ? null : meterPosition(state.dbRelMf))),
    start,
    stop,
    onFrame,
  })

  function tick() {
    if (!mic || !detector) return
    raf = requestAnimationFrame(tick)
    const now = performance.now()
    mic.analyser.getFloatTimeDomainData(buf)

    const db = toDb(rms(buf))
    // Fast attack, slower release, so the meter is readable.
    const alpha = db > state.db ? 0.5 : 0.15
    state.db = state.db + alpha * (db - state.db)

    const { freq, clarity } = detector.detect(buf, mic.ctx.sampleRate)
    const voiced = freq > 0 && clarity >= MIN_CLARITY && db > NOISE_GATE_DB

    for (const cb of listeners) cb({ time: now, freq, clarity, db, voiced })

    if (voiced) {
      // Reset smoothing when jumping to a different note.
      if (recentFreqs.length && Math.abs(12 * Math.log2(freq / recentFreqs[recentFreqs.length - 1])) > 0.6) {
        recentFreqs.length = 0
      }
      recentFreqs.push(freq)
      if (recentFreqs.length > SMOOTH_FRAMES) recentFreqs.shift()
      const f = median(recentFreqs)
      const r = analyzeFreq(f, settings.a4)
      state.freq = f
      state.midi = r.midi
      state.cents = r.cents
      state.hasPitch = true
      lastVoicedAt = now
      if (r.midi !== stableMidi) {
        stableMidi = r.midi
        stableSince = now
      }
      state.stableMs = now - stableSince
    } else if (now - lastVoicedAt > HOLD_MS) {
      state.hasPitch = false
      state.stableMs = 0
      stableMidi = -1
      recentFreqs.length = 0
    }
  }

  async function start() {
    if (state.running || starting) return
    starting = true
    state.error = null
    try {
      mic = await acquireMic()
      if (disposed) {
        mic = null
        releaseMic()
        return
      }
      detector = new Pitch(ANALYSER_SIZE)
      state.running = true
      raf = requestAnimationFrame(tick)
    } catch (e) {
      state.error = micErrorMessage(e)
    } finally {
      starting = false
    }
  }

  function stop() {
    if (!state.running) return
    cancelAnimationFrame(raf)
    mic = null
    detector = null
    releaseMic()
    Object.assign(state, { running: false, hasPitch: false, freq: 0, stableMs: 0, db: -100 })
  }

  function onFrame(cb: (f: TunerFrame) => void) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }

  onScopeDispose(() => {
    disposed = true
    stop()
  })

  return state
}
