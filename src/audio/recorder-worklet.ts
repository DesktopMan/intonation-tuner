/// AudioWorklet that forwards raw mono PCM from the mic to the main thread in chunks.
/// Runs in AudioWorkletGlobalScope, which TypeScript's DOM lib doesn't describe.

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
  abstract process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void

const CHUNK = 8192

class RecorderProcessor extends AudioWorkletProcessor {
  private buf = new Float32Array(CHUNK)
  private n = 0

  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent) => {
      if (e.data === 'flush') {
        this.send()
        this.port.postMessage('flushed')
      }
    }
  }

  private send() {
    if (this.n === 0) return
    const out = this.buf.slice(0, this.n)
    this.port.postMessage(out, [out.buffer])
    this.n = 0
  }

  process(inputs: Float32Array[][]): boolean {
    const ch = inputs[0]?.[0]
    if (ch) {
      let i = 0
      while (i < ch.length) {
        const take = Math.min(ch.length - i, CHUNK - this.n)
        this.buf.set(ch.subarray(i, i + take), this.n)
        this.n += take
        i += take
        if (this.n === CHUNK) this.send()
      }
    }
    return true
  }
}

registerProcessor('recorder', RecorderProcessor)

export {}
