import { getAudioContext } from './audioEngine'

/** A soft sustained tone (sine + a little 2nd harmonic) used for the
 *  reference tone and the drone. Glides between frequencies and fades in/out. */
export class Tone {
  private ctx = getAudioContext()
  private out: GainNode
  private oscs: OscillatorNode[] = []
  private playing = false

  constructor() {
    this.out = this.ctx.createGain()
    this.out.gain.value = 0
    this.out.connect(this.ctx.destination)
  }

  get isPlaying() {
    return this.playing
  }

  /** Start (or retarget) the tone. */
  play(freq: number, volume: number, fadeSec = 0.15) {
    const now = this.ctx.currentTime
    if (this.oscs.length === 0) {
      const partials: [number, number][] = [
        [1, 1],
        [2, 0.18],
        [3, 0.05],
      ]
      for (const [mult, amp] of partials) {
        const osc = this.ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq * mult
        const g = this.ctx.createGain()
        g.gain.value = amp
        osc.connect(g).connect(this.out)
        osc.start()
        this.oscs.push(osc)
      }
    } else {
      this.oscs.forEach((osc, i) => osc.frequency.setTargetAtTime(freq * (i + 1), now, 0.02))
    }
    const target = 0.25 * Math.max(0, Math.min(1, volume))
    this.out.gain.cancelScheduledValues(now)
    this.out.gain.setTargetAtTime(target, now, fadeSec / 3)
    this.playing = true
  }

  setVolume(volume: number) {
    if (!this.playing) return
    this.out.gain.setTargetAtTime(0.25 * volume, this.ctx.currentTime, 0.05)
  }

  stop(fadeSec = 0.3) {
    if (!this.playing) return
    this.playing = false
    const now = this.ctx.currentTime
    this.out.gain.cancelScheduledValues(now)
    this.out.gain.setTargetAtTime(0, now, fadeSec / 3)
    const oscs = this.oscs
    this.oscs = []
    oscs.forEach((o) => o.stop(now + fadeSec + 0.1))
  }

  dispose() {
    this.stop(0.05)
    setTimeout(() => this.out.disconnect(), 300)
  }
}
