/** Loudness helpers. Dynamics are estimated as dB offset from the session's
 *  calibrated mf level, so they are relative, not absolute. */

export type Marking = 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff'

export interface DynamicLevel {
  marking: Marking
  /** dB offset from mf. */
  db: number
}

export const DYNAMIC_LEVELS: readonly DynamicLevel[] = [
  { marking: 'pp', db: -16 },
  { marking: 'p', db: -10 },
  { marking: 'mp', db: -5 },
  { marking: 'mf', db: 0 },
  { marking: 'f', db: 5 },
  { marking: 'ff', db: 10 },
]

/** Range of the continuous meter, a little beyond pp and ff. */
export const METER_MIN_DB = -22
export const METER_MAX_DB = 15

export const SILENCE_DB = -100

export function rms(buf: ArrayLike<number>, start = 0, end = buf.length): number {
  let sum = 0
  for (let i = start; i < end; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / Math.max(1, end - start))
}

export function toDb(amplitude: number): number {
  return amplitude > 1e-5 ? 20 * Math.log10(amplitude) : SILENCE_DB
}

/** Nearest dynamic marking for a dB offset from mf. */
export function nearestMarking(dbRelMf: number): Marking {
  let best = DYNAMIC_LEVELS[0]
  for (const level of DYNAMIC_LEVELS) {
    if (Math.abs(level.db - dbRelMf) < Math.abs(best.db - dbRelMf)) best = level
  }
  return best.marking
}

/** Position on the meter in [0, 1], 0 = bottom (soft). */
export function meterPosition(dbRelMf: number): number {
  const t = (dbRelMf - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)
  return Math.min(1, Math.max(0, t))
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
