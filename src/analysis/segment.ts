import { freqToMidi } from '@/audio/music'
import { median } from '@/audio/dynamics'
import type { FrameData } from './types'

export interface SegmentOptions {
  a4?: number
  minClarity?: number
  /** Fixed noise gate in dBFS; if omitted it adapts to the recording's level. */
  gateDb?: number
  minNoteSec?: number
  maxGapSec?: number
  /** Semitones a frame may wander from the note before it counts as a new note. */
  hysteresis?: number
  /** Consecutive out-of-range frames needed to start a new note (rejects glitches). */
  confirmFrames?: number
}

export interface Segment {
  startFrame: number
  endFrame: number
  midi: number
}

interface Run {
  start: number
  last: number
  ref: number
  exacts: number[]
}

/** Gate relative to the loud parts of the recording, so quiet rooms and hot mics both work. */
export function adaptiveGate(frames: FrameData, minClarity: number): number {
  const loud: number[] = []
  for (let i = 0; i < frames.db.length; i++) if (frames.clarity[i] >= minClarity) loud.push(frames.db[i])
  if (loud.length === 0) return -60
  loud.sort((a, b) => a - b)
  const p95 = loud[Math.floor(loud.length * 0.95)]
  return Math.max(-70, Math.min(-45, p95 - 40))
}

export function isVoiced(frames: FrameData, i: number, minClarity: number, gateDb: number): boolean {
  return frames.freq[i] > 0 && frames.clarity[i] >= minClarity && frames.db[i] > gateDb
}

/** Split a pitch track into notes. */
export function segmentNotes(frames: FrameData, opts: SegmentOptions = {}): { segments: Segment[]; gateDb: number } {
  const a4 = opts.a4 ?? 440
  const minClarity = opts.minClarity ?? 0.9
  const gateDb = opts.gateDb ?? adaptiveGate(frames, minClarity)
  const minFrames = Math.ceil((opts.minNoteSec ?? 0.08) / frames.hopSec)
  const maxGapFrames = Math.round((opts.maxGapSec ?? 0.05) / frames.hopSec)
  const hyst = opts.hysteresis ?? 0.6
  const confirm = opts.confirmFrames ?? 3

  const segments: Segment[] = []
  let cur: Run | null = null
  let pending: Run | null = null

  const close = (run: Run) => {
    if (run.last - run.start + 1 >= minFrames) {
      segments.push({ startFrame: run.start, endFrame: run.last, midi: Math.round(median(run.exacts)) })
    }
  }
  const newRun = (i: number, e: number): Run => ({ start: i, last: i, ref: Math.round(e), exacts: [e] })

  for (let i = 0; i < frames.freq.length; i++) {
    if (!isVoiced(frames, i, minClarity, gateDb)) {
      if (cur && i - cur.last > maxGapFrames) {
        close(cur)
        cur = null
      }
      pending = null
      continue
    }
    const e = freqToMidi(frames.freq[i], a4)
    if (!cur) {
      cur = newRun(i, e)
      continue
    }
    if (Math.abs(e - cur.ref) <= hyst) {
      cur.last = i
      cur.exacts.push(e)
      pending = null
      continue
    }
    if (i - cur.last > maxGapFrames) {
      close(cur)
      cur = newRun(i, e)
      pending = null
      continue
    }
    if (pending && Math.abs(e - pending.ref) <= hyst) {
      pending.last = i
      pending.exacts.push(e)
    } else {
      pending = newRun(i, e)
    }
    if (pending.exacts.length >= confirm) {
      close(cur)
      cur = pending
      pending = null
    }
  }
  if (cur) close(cur)
  return { segments, gateDb }
}
