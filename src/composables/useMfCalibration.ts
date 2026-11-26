import { ref } from 'vue'
import { median } from '@/audio/dynamics'
import { useSession } from '@/stores/session'
import type { Tuner } from './useTuner'

export const CALIBRATION_MS = 3000
/** Need at least this much clearly pitched sound to accept a calibration. */
const MIN_VOICED_MS = 1200

/** Measures the player's mf level: median dB of voiced frames over ~3 s. */
export function useMfCalibration(tuner: Tuner) {
  const session = useSession()
  const progress = ref(0)
  const status = ref<'idle' | 'listening' | 'done' | 'failed'>('idle')
  let cancel: (() => void) | null = null

  async function calibrate(): Promise<boolean> {
    cancel?.()
    if (!tuner.running) await tuner.start()
    if (!tuner.running) {
      status.value = 'failed'
      return false
    }
    status.value = 'listening'
    progress.value = 0

    return new Promise<boolean>((resolve) => {
      const levels: number[] = []
      let lastTime = 0
      let voicedMs = 0

      const unsubscribe = tuner.onFrame((f) => {
        const dt = lastTime ? f.time - lastTime : 0
        lastTime = f.time
        if (!f.voiced) return
        // The clock only runs while the player is actually playing.
        voicedMs += dt
        levels.push(f.db)
        progress.value = Math.min(1, voicedMs / CALIBRATION_MS)
        if (voicedMs >= CALIBRATION_MS) finish()
      })

      const finish = (cancelled = false) => {
        unsubscribe()
        cancel = null
        if (!cancelled && voicedMs >= MIN_VOICED_MS && levels.length) {
          session.mfDb = median(levels)
          status.value = 'done'
          resolve(true)
        } else {
          status.value = cancelled ? 'idle' : 'failed'
          resolve(false)
        }
      }
      cancel = () => finish(true)
    })
  }

  return {
    progress,
    status,
    calibrate,
    cancel: () => cancel?.(),
    clear: () => (session.mfDb = null),
  }
}
