/** Shared audio resources: one AudioContext and one microphone stream for the
 *  whole app. Screens acquire/release the mic; it is switched off when no one
 *  is using it so the browser's recording indicator goes away. */

export const ANALYSER_SIZE = 4096

let ctx: AudioContext | null = null
let stream: MediaStream | null = null
let source: MediaStreamAudioSourceNode | null = null
let analyser: AnalyserNode | null = null
let users = 0
let pending: Promise<MicHandle> | null = null

export interface MicHandle {
  ctx: AudioContext
  source: MediaStreamAudioSourceNode
  analyser: AnalyserNode
}

export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' })
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

async function openMic(): Promise<MicHandle> {
  const audioCtx = getAudioContext()
  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // Processing would distort pitch and (especially AGC) the dynamics reading.
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    },
  })
  source = audioCtx.createMediaStreamSource(stream)
  analyser = audioCtx.createAnalyser()
  analyser.fftSize = ANALYSER_SIZE
  analyser.smoothingTimeConstant = 0
  source.connect(analyser)
  return { ctx: audioCtx, source, analyser }
}

/** Get the shared mic. Every call must be paired with releaseMic(). */
export async function acquireMic(): Promise<MicHandle> {
  users++
  if (source && analyser && ctx) {
    if (ctx.state === 'suspended') await ctx.resume()
    return { ctx, source, analyser }
  }
  pending ??= openMic().finally(() => (pending = null))
  try {
    return await pending
  } catch (e) {
    users--
    throw e
  }
}

export function releaseMic(): void {
  users = Math.max(0, users - 1)
  if (users > 0) return
  stream?.getTracks().forEach((t) => t.stop())
  source?.disconnect()
  stream = null
  source = null
  analyser = null
}

export function micErrorMessage(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError') return 'Microphone access was denied. Allow it in your browser settings.'
    if (e.name === 'NotFoundError') return 'No microphone found.'
  }
  if (!window.isSecureContext) return 'The microphone needs a secure (https) connection.'
  return `Could not open the microphone: ${e instanceof Error ? e.message : String(e)}`
}
