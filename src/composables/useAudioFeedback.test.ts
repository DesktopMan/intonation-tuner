import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { REFERENCE_RELEASE_MS, useAudioFeedback } from './useAudioFeedback'
import { useSettings } from '@/stores/settings'
import type { Tuner } from './useTuner'

vi.mock('@/audio/toneGenerator', () => ({
  Tone: class {
    play = vi.fn()
    stop = vi.fn()
    setVolume = vi.fn()
    dispose = vi.fn()
  },
}))

function fakeTuner() {
  return reactive({
    running: true,
    hasPitch: false,
    midi: 69,
    cents: 0,
    stableMs: 0,
  }) as unknown as Tuner & { running: boolean; hasPitch: boolean; midi: number; cents: number; stableMs: number }
}

async function advance(ms: number) {
  vi.advanceTimersByTime(ms)
  await nextTick()
}

describe('useAudioFeedback reference tone', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] })
    setActivePinia(createPinia())
    localStorage.clear()
    useSettings().settings.feedbackMode = 'reference'
  })
  afterEach(() => vi.useRealTimers())

  function setup() {
    const tuner = fakeTuner()
    const scope = effectScope()
    const fb = scope.run(() => useAudioFeedback(tuner))!
    return { tuner, fb, scope }
  }

  async function holdOutOfTune(tuner: ReturnType<typeof fakeTuner>) {
    Object.assign(tuner, { hasPitch: true, midi: 69, cents: 20, stableMs: 400 })
    await nextTick()
  }

  it('plays when a held note is out of tune', async () => {
    const { tuner, fb } = setup()
    await holdOutOfTune(tuner)
    expect(fb.sounding.value).toBe(69)
  })

  it('keeps playing while the player holds the note out of tune', async () => {
    const { tuner, fb } = setup()
    await holdOutOfTune(tuner)
    await advance(10_000)
    expect(fb.sounding.value).toBe(69)
  })

  it('stops a couple of seconds after the player stops, even if the tuner reading no longer changes', async () => {
    const { tuner, fb } = setup()
    await holdOutOfTune(tuner)
    tuner.hasPitch = false
    tuner.stableMs = 0
    await nextTick()
    await advance(REFERENCE_RELEASE_MS - 300)
    expect(fb.sounding.value).toBe(69) // still within the release window
    await advance(500)
    expect(fb.sounding.value).toBeNull()
  })

  it('plays again on the next out-of-tune note', async () => {
    const { tuner, fb } = setup()
    await holdOutOfTune(tuner)
    tuner.hasPitch = false
    tuner.stableMs = 0
    await advance(REFERENCE_RELEASE_MS + 200)
    expect(fb.sounding.value).toBeNull()
    await holdOutOfTune(tuner)
    expect(fb.sounding.value).toBe(69)
  })

  it('stops when the player gets back in tune', async () => {
    const { tuner, fb } = setup()
    await holdOutOfTune(tuner)
    tuner.cents = 2
    await nextTick()
    expect(fb.sounding.value).toBeNull()
  })

  it('cleans up its timer when disposed', async () => {
    const { tuner, fb, scope } = setup()
    await holdOutOfTune(tuner)
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(fb.sounding.value).toBe(69)
  })
})
