import { describe, expect, it } from 'vitest'
import { median, meterPosition, nearestMarking, rms, toDb } from './dynamics'

describe('dynamics', () => {
  it('maps offsets to the nearest marking', () => {
    expect(nearestMarking(0)).toBe('mf')
    expect(nearestMarking(2)).toBe('mf')
    expect(nearestMarking(3)).toBe('f')
    expect(nearestMarking(-7)).toBe('mp')
    expect(nearestMarking(-30)).toBe('pp')
    expect(nearestMarking(25)).toBe('ff')
  })

  it('meter position is clamped and monotonic', () => {
    expect(meterPosition(-100)).toBe(0)
    expect(meterPosition(100)).toBe(1)
    expect(meterPosition(0)).toBeGreaterThan(meterPosition(-5))
  })

  it('RMS of a full-scale sine is ~-3 dB', () => {
    const buf = Float32Array.from({ length: 4800 }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / 48000))
    expect(toDb(rms(buf))).toBeCloseTo(-3.01, 1)
  })

  it('median', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })
})
