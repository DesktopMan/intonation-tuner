import { describe, expect, it } from 'vitest'
import { analyzeFreq, formatCents, midiToFreq, noteName, tuneZone, writtenPitchClass } from './music'

describe('music', () => {
  it('A4 = 440 is exactly A4', () => {
    const r = analyzeFreq(440)
    expect(r.midi).toBe(69)
    expect(r.cents).toBeCloseTo(0, 6)
    expect(noteName(r.midi).label).toBe('A4')
  })

  it('446 Hz is ~+23.4 cents sharp of A4', () => {
    const r = analyzeFreq(446)
    expect(r.midi).toBe(69)
    expect(r.cents).toBeCloseTo(23.45, 1)
  })

  it('respects A4 reference', () => {
    const r = analyzeFreq(442, 442)
    expect(r.midi).toBe(69)
    expect(r.cents).toBeCloseTo(0, 6)
    expect(analyzeFreq(440, 442).cents).toBeCloseTo(-7.85, 1)
  })

  it('names middle C and rounds near the boundary', () => {
    expect(noteName(60).label).toBe('C4')
    expect(analyzeFreq(midiToFreq(60.49)).midi).toBe(60)
    expect(analyzeFreq(midiToFreq(60.51)).midi).toBe(61)
  })

  it('transposes for B♭ instruments: concert B♭ reads as written C', () => {
    const concertBb = 70 // B♭4
    expect(noteName(concertBb).label).toBe('A♯4')
    expect(noteName(concertBb, { instrumentKey: 'Bb', accidentals: 'flats' }).label).toBe('C5')
    expect(writtenPitchClass(concertBb, 'Bb')).toBe(0)
  })

  it('uses flats when asked', () => {
    expect(noteName(61, { instrumentKey: 'C', accidentals: 'flats' }).name).toBe('D♭')
  })

  it('formats cents and zones', () => {
    expect(formatCents(12.4)).toBe('+12')
    expect(formatCents(-4.6)).toBe('−5')
    expect(formatCents(0.3)).toBe('0')
    expect(tuneZone(4, 5)).toBe('good')
    expect(tuneZone(-12, 5)).toBe('warn')
    expect(tuneZone(20, 5)).toBe('bad')
  })
})
