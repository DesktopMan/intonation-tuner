import { freqToMidi, tuneZone } from '@/audio/music'
import { DYNAMIC_LEVELS, median, nearestMarking, type Marking } from '@/audio/dynamics'
import { computeFrames } from './frames'
import { isVoiced, segmentNotes, type Segment } from './segment'
import type { Analysis, DynamicStat, FrameData, GroupStat, Note, PitchClassStat, Summary } from './types'

const MIN_CLARITY = 0.9
const ATTACK_SEC = 0.06
const RELEASE_SEC = 0.03
/** Frames further than this from the note (in cents) are slides/glitches, not the note. */
const MAX_DEVIATION = 60

/** Cents deviation of each usable frame of a note, as [frameIndex, cents] pairs. */
export function noteCurve(frames: FrameData, note: { startFrame: number; endFrame: number; midi: number }, a4: number, gateDb: number) {
  const out: [number, number][] = []
  for (let i = note.startFrame; i <= note.endFrame; i++) {
    if (!isVoiced(frames, i, MIN_CLARITY, gateDb)) continue
    const c = (freqToMidi(frames.freq[i], a4) - note.midi) * 100
    if (Math.abs(c) <= MAX_DEVIATION) out.push([i, c])
  }
  return out
}

function buildNote(frames: FrameData, seg: Segment, id: number, a4: number, gateDb: number): Note {
  const curve = noteCurve(frames, seg, a4, gateDb)
  const skipStart = seg.startFrame + Math.round(ATTACK_SEC / frames.hopSec)
  const skipEnd = seg.endFrame - Math.round(RELEASE_SEC / frames.hopSec)
  let steady = curve.filter(([i]) => i >= skipStart && i <= skipEnd).map(([, c]) => c)
  if (steady.length < 3) steady = curve.map(([, c]) => c)

  let dbSum = 0
  for (const [i] of curve) dbSum += frames.db[i]

  return {
    id,
    startFrame: seg.startFrame,
    endFrame: seg.endFrame,
    start: frames.times[seg.startFrame] - frames.hopSec / 2,
    end: frames.times[seg.endFrame] + frames.hopSec / 2,
    midi: seg.midi,
    cents: median(steady),
    meanDb: curve.length ? dbSum / curve.length : -100,
  }
}

export function analyzeRecording(
  samples: Float32Array,
  sampleRate: number,
  a4: number,
  onProgress?: (fraction: number) => void,
): Analysis {
  const frames = computeFrames(samples, sampleRate, { onProgress })
  const { segments, gateDb } = segmentNotes(frames, { a4, minClarity: MIN_CLARITY })
  const notes = segments.map((s, i) => buildNote(frames, s, i, a4, gateDb)).filter((n) => Number.isFinite(n.cents))
  return { duration: samples.length / sampleRate, sampleRate, a4, frames, notes, gateDb }
}

function groupStat(cents: number[], tolerance: number): GroupStat {
  return {
    count: cents.length,
    meanCents: cents.reduce((a, b) => a + b, 0) / cents.length,
    minCents: Math.min(...cents),
    maxCents: Math.max(...cents),
    inTune: cents.filter((c) => tuneZone(c, tolerance) === 'good').length,
  }
}

export function summarize(notes: Note[], tolerance: number): Summary {
  const groups = new Map<number, number[]>()
  for (const n of notes) {
    const pc = ((n.midi % 12) + 12) % 12
    if (!groups.has(pc)) groups.set(pc, [])
    groups.get(pc)!.push(n.cents)
  }
  const byPitchClass: PitchClassStat[] = [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pc, cs]) => ({ pc, ...groupStat(cs, tolerance) }))
  const count = notes.length
  const sum = (f: (n: Note) => number) => notes.reduce((a, n) => a + f(n), 0)
  return {
    count,
    inTunePct: count ? (100 * notes.filter((n) => tuneZone(n.cents, tolerance) === 'good').length) / count : 0,
    meanAbsCents: count ? sum((n) => Math.abs(n.cents)) / count : 0,
    meanCents: count ? sum((n) => n.cents) / count : 0,
    byPitchClass,
  }
}

/** Dynamic marking of a note, relative to the calibrated mf level. */
export function noteMarking(note: Note, mfDb: number): Marking {
  return nearestMarking(note.meanDb - mfDb)
}

/** Intonation grouped by dynamic marking, softest first. Only markings that occur are returned. */
export function summarizeByDynamic(notes: Note[], mfDb: number, tolerance: number): DynamicStat[] {
  const groups = new Map<Marking, number[]>()
  for (const n of notes) {
    const m = noteMarking(n, mfDb)
    if (!groups.has(m)) groups.set(m, [])
    groups.get(m)!.push(n.cents)
  }
  return DYNAMIC_LEVELS.filter((l) => groups.has(l.marking)).map((l) => ({
    marking: l.marking,
    ...groupStat(groups.get(l.marking)!, tolerance),
  }))
}

export interface DynamicInsight {
  soft: DynamicStat
  loud: DynamicStat
  /** soft.meanCents − loud.meanCents: negative = flatter when soft. */
  diff: number
}

/** Compare the softest and loudest dynamics that have enough notes to be meaningful. */
export function dynamicInsight(byDynamic: DynamicStat[], minNotes = 2): DynamicInsight | null {
  const usable = byDynamic.filter((d) => d.count >= minNotes)
  if (usable.length < 2) return null
  const soft = usable[0]
  const loud = usable[usable.length - 1]
  return { soft, loud, diff: soft.meanCents - loud.meanCents }
}
