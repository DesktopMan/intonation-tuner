import { defineStore } from 'pinia'
import { computed, reactive, watch } from 'vue'
import type { Accidentals, InstrumentKey, NameOptions } from '@/audio/music'

export type FeedbackMode = 'off' | 'reference' | 'drone'

export interface Settings {
  a4: number
  instrumentKey: InstrumentKey
  accidentals: Accidentals
  /** ± cents counted as "in tune". */
  tolerance: number
  feedbackMode: FeedbackMode
  /** 'follow' = drone follows the nearest note being played, otherwise a concert MIDI number. */
  droneTarget: 'follow' | number
  feedbackVolume: number
  showDynamicsLane: boolean
}

const STORAGE_KEY = 'intonation-tuner:settings'

export const DEFAULT_SETTINGS: Settings = {
  a4: 440,
  instrumentKey: 'C',
  accidentals: 'sharps',
  tolerance: 5,
  feedbackMode: 'off',
  droneTarget: 'follow',
  feedbackVolume: 0.5,
  showDynamicsLane: true,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // ignore corrupt storage
  }
  return { ...DEFAULT_SETTINGS }
}

/** Persisted user preferences. */
export const useSettings = defineStore('settings', () => {
  const settings = reactive<Settings>(load())

  watch(settings, (s) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s)), { deep: true })

  const nameOptions = computed<NameOptions>(() => ({
    instrumentKey: settings.instrumentKey,
    accidentals: settings.accidentals,
  }))

  function reset() {
    Object.assign(settings, DEFAULT_SETTINGS)
  }

  return { settings, nameOptions, reset }
})
