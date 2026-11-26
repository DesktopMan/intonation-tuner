import { PitchDetector } from 'pitchy'

/** Lowest/highest fundamental we report (roughly A0..C8). */
export const MIN_FREQ = 27
export const MAX_FREQ = 4200

export interface PitchEstimate {
  /** Hz, or 0 if nothing plausible. */
  freq: number
  /** 0..1 confidence that the signal is periodic. */
  clarity: number
}

/** Thin wrapper so the detection algorithm can be swapped without touching callers. */
export class Pitch {
  private detector: PitchDetector<Float32Array>
  readonly windowSize: number

  constructor(windowSize: number) {
    this.windowSize = windowSize
    this.detector = PitchDetector.forFloat32Array(windowSize)
    this.detector.minVolumeDecibels = -80
  }

  detect(input: Float32Array, sampleRate: number): PitchEstimate {
    const [freq, clarity] = this.detector.findPitch(input, sampleRate)
    if (!Number.isFinite(freq) || freq < MIN_FREQ || freq > MAX_FREQ) return { freq: 0, clarity: 0 }
    return { freq, clarity }
  }
}
