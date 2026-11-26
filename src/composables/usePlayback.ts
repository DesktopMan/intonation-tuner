import { onScopeDispose, ref } from 'vue'
import { getAudioContext } from '@/audio/audioEngine'
import type { Recording } from '@/stores/session'

/** Plays back (parts of) a recording and tracks the play position for a cursor. */
export function usePlayback() {
  const playing = ref(false)
  /** Current position in seconds, or null when stopped. */
  const position = ref<number | null>(null)

  let buffer: AudioBuffer | null = null
  let bufferFor: Recording | null = null
  let src: AudioBufferSourceNode | null = null
  let raf = 0

  function getBuffer(rec: Recording): AudioBuffer {
    if (bufferFor !== rec || !buffer) {
      const ctx = getAudioContext()
      buffer = ctx.createBuffer(1, rec.samples.length, rec.sampleRate)
      buffer.copyToChannel(rec.samples as Float32Array<ArrayBuffer>, 0)
      bufferFor = rec
    }
    return buffer
  }

  function play(rec: Recording, from = 0, to?: number) {
    stop()
    const ctx = getAudioContext()
    const buf = getBuffer(rec)
    const node = ctx.createBufferSource()
    node.buffer = buf
    node.connect(ctx.destination)
    const start = Math.max(0, from)
    const dur = to != null ? Math.max(0.05, to - start) : undefined
    const startedAt = ctx.currentTime
    node.start(0, start, dur)
    node.onended = () => {
      if (src === node) stop()
    }
    src = node
    playing.value = true
    const tick = () => {
      position.value = start + (ctx.currentTime - startedAt)
      raf = requestAnimationFrame(tick)
    }
    tick()
  }

  function stop() {
    cancelAnimationFrame(raf)
    if (src) {
      src.onended = null
      try {
        src.stop()
      } catch {
        // already stopped
      }
      src.disconnect()
      src = null
    }
    playing.value = false
    position.value = null
  }

  onScopeDispose(stop)

  return { playing, position, play, stop }
}
