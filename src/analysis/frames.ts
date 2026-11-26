import { Pitch } from '@/audio/pitch'
import { rms, toDb } from '@/audio/dynamics'
import type { FrameData } from './types'

export interface FrameOptions {
  hopSec?: number
  windowSize?: number
  onProgress?: (fraction: number) => void
}

/** Slide a window over the recording and estimate pitch, clarity and level per frame. */
export function computeFrames(samples: Float32Array, sampleRate: number, opts: FrameOptions = {}): FrameData {
  const hopSec = opts.hopSec ?? 0.01
  const windowSize = opts.windowSize ?? 2048
  const hop = Math.max(1, Math.round(hopSec * sampleRate))
  const count = samples.length < windowSize ? 0 : Math.floor((samples.length - windowSize) / hop) + 1

  const times = new Float32Array(count)
  const freq = new Float32Array(count)
  const clarity = new Float32Array(count)
  const db = new Float32Array(count)
  const detector = new Pitch(windowSize)
  const progressEvery = Math.max(1, Math.floor(count / 100))

  for (let i = 0; i < count; i++) {
    const start = i * hop
    const win = samples.subarray(start, start + windowSize)
    times[i] = (start + windowSize / 2) / sampleRate
    db[i] = toDb(rms(win))
    const p = detector.detect(win, sampleRate)
    freq[i] = p.freq
    clarity[i] = p.clarity
    if (opts.onProgress && i % progressEvery === 0) opts.onProgress(i / count)
  }
  opts.onProgress?.(1)
  return { hopSec: hop / sampleRate, times, freq, clarity, db }
}
