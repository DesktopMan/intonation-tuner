import { onScopeDispose, ref } from 'vue'
import workletUrl from '@/audio/recorder-worklet.ts?worker&url'
import { acquireMic, micErrorMessage, releaseMic } from '@/audio/audioEngine'
import type { Recording } from '@/stores/session'

export const MAX_RECORDING_SEC = 15 * 60

const loadedContexts = new WeakSet<BaseAudioContext>()

/** Records raw mono PCM from the shared microphone. */
export function useRecorder(opts: { onAutoStop?: (rec: Recording) => void } = {}) {
  const recording = ref(false)
  const elapsed = ref(0)
  const error = ref<string | null>(null)

  let node: AudioWorkletNode | null = null
  let sink: GainNode | null = null
  let chunks: Float32Array[] = []
  let sampleRate = 48000
  let timer = 0
  let startedAt = 0

  async function start() {
    if (recording.value) return
    error.value = null
    try {
      const mic = await acquireMic()
      const ctx = mic.ctx
      if (!loadedContexts.has(ctx)) {
        await ctx.audioWorklet.addModule(workletUrl)
        loadedContexts.add(ctx)
      }
      sampleRate = ctx.sampleRate
      chunks = []
      node = new AudioWorkletNode(ctx, 'recorder', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 })
      node.port.onmessage = (e: MessageEvent) => {
        if (e.data instanceof Float32Array) chunks.push(e.data)
      }
      // Keep the node in a rendered graph (some browsers only process connected nodes) without making sound.
      sink = ctx.createGain()
      sink.gain.value = 0
      mic.source.connect(node)
      node.connect(sink).connect(ctx.destination)

      startedAt = performance.now()
      elapsed.value = 0
      recording.value = true
      timer = window.setInterval(() => {
        elapsed.value = (performance.now() - startedAt) / 1000
        if (elapsed.value >= MAX_RECORDING_SEC) void stop().then((r) => r && opts.onAutoStop?.(r))
      }, 200)
    } catch (e) {
      error.value = micErrorMessage(e)
      cleanup()
    }
  }

  function cleanup() {
    clearInterval(timer)
    node?.disconnect()
    sink?.disconnect()
    if (node) releaseMic()
    node = null
    sink = null
    recording.value = false
  }

  async function stop(): Promise<Recording | null> {
    if (!recording.value || !node) return null
    const n = node
    // Ask the worklet for its partial buffer before disconnecting.
    await new Promise<void>((resolve) => {
      const done = setTimeout(resolve, 500)
      n.port.addEventListener('message', (e) => {
        if (e.data === 'flushed') {
          clearTimeout(done)
          resolve()
        }
      })
      n.port.postMessage('flush')
    })
    cleanup()
    const length = chunks.reduce((a, c) => a + c.length, 0)
    const samples = new Float32Array(length)
    let off = 0
    for (const c of chunks) {
      samples.set(c, off)
      off += c.length
    }
    chunks = []
    return { samples, sampleRate }
  }

  onScopeDispose(cleanup)

  return { recording, elapsed, error, start, stop }
}
