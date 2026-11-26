import { onScopeDispose, ref, watch } from 'vue'
import { midiToFreq, tuneZone } from '@/audio/music'
import { Tone } from '@/audio/toneGenerator'
import { useSettings } from '@/stores/settings'
import type { Tuner } from './useTuner'

/** Hold a note this long before the reference tone kicks in. */
const REFERENCE_DELAY_MS = 300
/** Follow-mode drone only moves after a new note is held this long. */
const DRONE_FOLLOW_MS = 500
/** Stop the reference tone this long after the player stops playing. */
export const REFERENCE_RELEASE_MS = 2000
/** How often stop conditions are re-checked, even when the tuner reading doesn't change. */
const CHECK_INTERVAL_MS = 100

/**
 * Audio feedback driven by a tuner:
 *  - 'reference': plays the correct pitch while a held note is out of tune, and stops when
 *    the player gets in tune, changes note, or stops playing (after REFERENCE_RELEASE_MS).
 *  - 'drone': plays a sustained target note (fixed or following the player).
 */
export function useAudioFeedback(tuner: Tuner) {
  const { settings } = useSettings()
  let tone: Tone | null = null
  /** Concert MIDI note currently sounding, or null. */
  const sounding = ref<number | null>(null)
  let lastPitchAt = 0

  function ensureTone() {
    tone ??= new Tone()
    return tone
  }

  function play(midi: number) {
    ensureTone().play(midiToFreq(midi, settings.a4), settings.feedbackVolume)
    sounding.value = midi
  }

  function silence() {
    tone?.stop()
    sounding.value = null
  }

  function update() {
    const now = performance.now()
    if (tuner.hasPitch) lastPitchAt = now
    const mode = settings.feedbackMode

    if (mode === 'off' || !tuner.running) {
      if (sounding.value != null) silence()
      return
    }

    if (mode === 'drone') {
      if (settings.droneTarget !== 'follow') {
        if (sounding.value !== settings.droneTarget) play(settings.droneTarget)
      } else if (tuner.hasPitch && tuner.stableMs >= DRONE_FOLLOW_MS && sounding.value !== tuner.midi) {
        play(tuner.midi)
      }
      return
    }

    // Reference tone mode.
    const outOfTune = tuneZone(tuner.cents, settings.tolerance) !== 'good'
    if (tuner.hasPitch && tuner.stableMs >= REFERENCE_DELAY_MS && outOfTune) {
      if (sounding.value !== tuner.midi) play(tuner.midi)
    } else if (sounding.value != null) {
      const backInTune = tuner.hasPitch && !outOfTune
      const changedNote = tuner.hasPitch && tuner.midi !== sounding.value
      const stoppedPlaying = now - lastPitchAt > REFERENCE_RELEASE_MS
      if (backInTune || changedNote || stoppedPlaying) silence()
    }
  }

  watch(
    () => [tuner.running, tuner.hasPitch, tuner.midi, tuner.cents, tuner.stableMs] as const,
    update,
  )
  watch(
    () => [settings.feedbackMode, settings.droneTarget, settings.a4] as const,
    () => {
      silence()
      update()
    },
  )
  // The "stopped playing" timeout must be checked even when the tuner reading stops changing.
  const ticker = window.setInterval(() => {
    if (sounding.value != null && settings.feedbackMode === 'reference') update()
  }, CHECK_INTERVAL_MS)

  watch(
    () => settings.feedbackVolume,
    (v) => tone?.setVolume(v),
  )

  onScopeDispose(() => {
    clearInterval(ticker)
    tone?.dispose()
    tone = null
  })

  return { sounding }
}
