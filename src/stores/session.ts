import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { Analysis } from '@/analysis/types'

export interface Recording {
  samples: Float32Array
  sampleRate: number
}

/** In-memory state for this browser session only. Never persisted. */
export const useSession = defineStore('session', () => {
  /** Calibrated mf level in dBFS, or null if not calibrated yet. */
  const mfDb = ref<number | null>(null)
  const recording = shallowRef<Recording | null>(null)
  const analysis = shallowRef<Analysis | null>(null)

  return { mfDb, recording, analysis }
})
