/** Pitch math for 12-tone equal temperament. All analysis is concert pitch;
 *  transposition only affects how note names are displayed. */

export type InstrumentKey = 'C' | 'Bb' | 'Eb' | 'F'
export type Accidentals = 'sharps' | 'flats'

/** Semitones to add to concert pitch to get written pitch. */
export const TRANSPOSITION: Record<InstrumentKey, number> = {
  C: 0,
  Bb: 2, // clarinet, trumpet: written a major 2nd above concert
  Eb: 9, // alto sax: written a major 6th above concert
  F: 7, // horn: written a perfect 5th above concert
}

export const INSTRUMENT_KEY_LABELS: Record<InstrumentKey, string> = {
  C: 'C (concert pitch)',
  Bb: 'B♭ (clarinet, trumpet)',
  Eb: 'E♭ (alto sax)',
  F: 'F (horn)',
}

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

export interface NameOptions {
  instrumentKey: InstrumentKey
  accidentals: Accidentals
}

export const DEFAULT_NAME_OPTIONS: NameOptions = { instrumentKey: 'C', accidentals: 'sharps' }

/** Continuous MIDI number (69 = A4) for a frequency. */
export function freqToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4)
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12)
}

export interface PitchReading {
  /** Nearest equal-tempered note (concert MIDI number). */
  midi: number
  /** Deviation from that note in cents, in [-50, 50). */
  cents: number
}

export function analyzeFreq(freq: number, a4 = 440): PitchReading {
  const exact = freqToMidi(freq, a4)
  const midi = Math.round(exact)
  return { midi, cents: (exact - midi) * 100 }
}

/** Cents between a frequency and a specific target note. */
export function centsFrom(freq: number, targetMidi: number, a4 = 440): number {
  return (freqToMidi(freq, a4) - targetMidi) * 100
}

export interface NoteName {
  /** Pitch-class name, e.g. "F♯". */
  name: string
  octave: number
  /** Name with octave, e.g. "F♯4". */
  label: string
}

/** Display name of a concert MIDI note, in the instrument's written pitch. */
export function noteName(concertMidi: number, opts: NameOptions = DEFAULT_NAME_OPTIONS): NoteName {
  const written = concertMidi + TRANSPOSITION[opts.instrumentKey]
  const pc = ((written % 12) + 12) % 12
  const octave = Math.floor(written / 12) - 1
  const name = (opts.accidentals === 'flats' ? FLAT_NAMES : SHARP_NAMES)[pc]
  return { name, octave, label: `${name}${octave}` }
}

/** Written pitch class (0 = C) of a concert MIDI note. */
export function writtenPitchClass(concertMidi: number, key: InstrumentKey): number {
  return (((concertMidi + TRANSPOSITION[key]) % 12) + 12) % 12
}

export function pitchClassName(pc: number, accidentals: Accidentals): string {
  return (accidentals === 'flats' ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12]
}

/** "+12", "−4", "0" style cents label. */
export function formatCents(cents: number): string {
  const r = Math.round(cents)
  if (r === 0) return '0'
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`
}

export type TuneZone = 'good' | 'warn' | 'bad'

/** Zone for a deviation. Uses the rounded value so colours always agree with the displayed number. */
export function tuneZone(cents: number, tolerance: number): TuneZone {
  const a = Math.abs(Math.round(cents))
  if (a <= tolerance) return 'good'
  if (a <= tolerance * 3) return 'warn'
  return 'bad'
}
