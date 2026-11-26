import { describe, expect, it } from 'vitest'
import { midiToFreq } from '@/audio/music'
import { analyzeRecording, dynamicInsight, summarize, summarizeByDynamic } from './stats'

const SR = 44100

interface Part {
  /** Concert MIDI note, or null for silence. */
  midi: number | null
  cents?: number
  sec: number
  amp?: number
}

/** Synthesize a phase-continuous signal with a few harmonics, like a simple instrument. */
function synth(parts: Part[], noise = 0.002): Float32Array {
  const total = Math.round(parts.reduce((a, p) => a + p.sec, 0) * SR)
  const out = new Float32Array(total)
  let phase = 0
  let pos = 0
  let seed = 1
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  for (const p of parts) {
    const n = Math.round(p.sec * SR)
    const f = p.midi == null ? 0 : midiToFreq(p.midi + (p.cents ?? 0) / 100)
    const amp = p.amp ?? 0.3
    for (let i = 0; i < n; i++) {
      // 10 ms fade in/out per note to avoid clicks.
      const env = Math.min(1, i / (0.01 * SR), (n - i) / (0.01 * SR))
      phase += (2 * Math.PI * f) / SR
      const s = p.midi == null ? 0 : amp * env * (Math.sin(phase) + 0.4 * Math.sin(2 * phase) + 0.2 * Math.sin(3 * phase))
      out[pos++] = s + noise * rand()
    }
  }
  return out
}

describe('analyzeRecording', () => {
  it('finds detuned notes separated by rests', () => {
    const samples = synth([
      { midi: null, sec: 0.2 },
      { midi: 60, cents: -10, sec: 0.5 }, // C4 -10
      { midi: null, sec: 0.15 },
      { midi: 62, cents: 20, sec: 0.5 }, // D4 +20
      { midi: null, sec: 0.15 },
      { midi: 64, cents: 0, sec: 0.5 }, // E4 0
      { midi: null, sec: 0.2 },
    ])
    const a = analyzeRecording(samples, SR, 440)
    expect(a.notes.map((n) => n.midi)).toEqual([60, 62, 64])
    expect(a.notes[0].cents).toBeCloseTo(-10, 0)
    expect(a.notes[1].cents).toBeCloseTo(20, 0)
    expect(Math.abs(a.notes[2].cents)).toBeLessThan(2)
    // Boundaries within ~30 ms (window is ~46 ms at 44.1 kHz)
    expect(a.notes[0].start).toBeGreaterThan(0.2 - 0.03)
    expect(a.notes[0].start).toBeLessThan(0.2 + 0.03)
    expect(a.notes[0].end).toBeGreaterThan(0.7 - 0.03)
    expect(a.notes[0].end).toBeLessThan(0.7 + 0.03)
  })

  it('splits legato notes without rests', () => {
    const samples = synth([
      { midi: null, sec: 0.1 },
      { midi: 67, cents: 5, sec: 0.4 },
      { midi: 69, cents: -15, sec: 0.4 },
      { midi: 71, cents: 0, sec: 0.4 },
      { midi: null, sec: 0.1 },
    ])
    const a = analyzeRecording(samples, SR, 440)
    expect(a.notes.map((n) => n.midi)).toEqual([67, 69, 71])
    expect(a.notes[0].cents).toBeCloseTo(5, 0)
    expect(a.notes[1].cents).toBeCloseTo(-15, 0)
    expect(a.notes[1].start).toBeGreaterThan(0.5 - 0.03)
    expect(a.notes[1].start).toBeLessThan(0.5 + 0.03)
  })

  it('honours the A4 reference', () => {
    // 442 Hz played against A4 = 442 is in tune.
    const samples = synth([{ midi: 69, cents: 7.85, sec: 0.6 }])
    const a = analyzeRecording(samples, SR, 442)
    expect(a.notes).toHaveLength(1)
    expect(Math.abs(a.notes[0].cents)).toBeLessThan(1)
  })

  it('finds no notes in silence or noise', () => {
    expect(analyzeRecording(synth([{ midi: null, sec: 1 }], 0), SR, 440).notes).toHaveLength(0)
    expect(analyzeRecording(synth([{ midi: null, sec: 1 }], 0.2), SR, 440).notes).toHaveLength(0)
  })

  it('ignores very short blips', () => {
    const samples = synth([
      { midi: null, sec: 0.2 },
      { midi: 60, sec: 0.04 },
      { midi: null, sec: 0.2 },
    ])
    expect(analyzeRecording(samples, SR, 440).notes).toHaveLength(0)
  })
})

describe('summarize', () => {
  it('groups by pitch class across octaves', () => {
    const note = (midi: number, cents: number) => ({ id: 0, startFrame: 0, endFrame: 0, start: 0, end: 0, midi, cents, meanDb: -20 })
    const s = summarize([note(66, 10), note(78, 20), note(60, 2)], 5)
    expect(s.count).toBe(3)
    expect(s.inTunePct).toBeCloseTo(33.3, 0)
    const fs = s.byPitchClass.find((p) => p.pc === 6)!
    expect(fs.count).toBe(2)
    expect(fs.meanCents).toBe(15)
    expect(fs.minCents).toBe(10)
    expect(fs.maxCents).toBe(20)
  })
})

describe('summarizeByDynamic', () => {
  const note = (cents: number, meanDb: number) => ({ id: 0, startFrame: 0, endFrame: 0, start: 0, end: 0, midi: 60, cents, meanDb })
  // mf calibrated at -20 dBFS: -30 dB is p (-10), -20 is mf, -15 is f (+5)
  const notes = [note(-14, -30), note(-10, -30), note(0, -20), note(2, -20), note(4, -15), note(6, -15)]

  it('groups notes by marking, softest first', () => {
    const d = summarizeByDynamic(notes, -20, 5)
    expect(d.map((x) => x.marking)).toEqual(['p', 'mf', 'f'])
    expect(d[0].meanCents).toBe(-12)
    expect(d[0].inTune).toBe(0)
    expect(d[2].meanCents).toBe(5)
  })

  it('compares the softest and loudest dynamics', () => {
    const i = dynamicInsight(summarizeByDynamic(notes, -20, 5))!
    expect(i.soft.marking).toBe('p')
    expect(i.loud.marking).toBe('f')
    expect(i.diff).toBe(-17)
  })

  it('needs at least two dynamics with enough notes', () => {
    expect(dynamicInsight(summarizeByDynamic([note(0, -20), note(1, -20), note(5, -30)], -20, 5))).toBeNull()
  })
})
