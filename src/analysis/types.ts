import type { Marking } from '@/audio/dynamics'

/** Per-frame pitch track of a recording (struct-of-arrays for compactness). */
export interface FrameData {
  hopSec: number
  /** Frame centre times in seconds. */
  times: Float32Array
  /** Detected frequency in Hz, 0 if none. */
  freq: Float32Array
  clarity: Float32Array
  /** Level in dBFS. */
  db: Float32Array
}

export interface Note {
  id: number
  startFrame: number
  endFrame: number
  /** Seconds. */
  start: number
  end: number
  /** Concert MIDI note the player was aiming for. */
  midi: number
  /** Median deviation of the steady part of the note, in cents. */
  cents: number
  /** Mean level in dBFS. */
  meanDb: number
}

export interface Analysis {
  duration: number
  sampleRate: number
  a4: number
  frames: FrameData
  notes: Note[]
  /** Noise gate used, dBFS. */
  gateDb: number
}

/** Intonation statistics for a group of notes. */
export interface GroupStat {
  count: number
  meanCents: number
  minCents: number
  maxCents: number
  /** Notes within tolerance. */
  inTune: number
}

export interface PitchClassStat extends GroupStat {
  /** Concert pitch class, 0 = C. */
  pc: number
}

export interface DynamicStat extends GroupStat {
  marking: Marking
}

/** What the user has selected to emphasise on the timeline. */
export type Highlight = { kind: 'pc'; pc: number } | { kind: 'dyn'; marking: Marking } | null

export interface Summary {
  count: number
  inTunePct: number
  meanAbsCents: number
  meanCents: number
  byPitchClass: PitchClassStat[]
}
