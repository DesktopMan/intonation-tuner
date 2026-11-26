import { analyzeRecording } from './stats'
import type { Analysis } from './types'

export interface AnalysisRequest {
  samples: Float32Array
  sampleRate: number
  a4: number
}

export type AnalysisMessage = { type: 'progress'; fraction: number } | { type: 'done'; analysis: Analysis }

self.onmessage = (e: MessageEvent<AnalysisRequest>) => {
  const { samples, sampleRate, a4 } = e.data
  const analysis = analyzeRecording(samples, sampleRate, a4, (fraction) =>
    self.postMessage({ type: 'progress', fraction } satisfies AnalysisMessage),
  )
  const f = analysis.frames
  self.postMessage({ type: 'done', analysis } satisfies AnalysisMessage, {
    transfer: [f.times.buffer, f.freq.buffer, f.clarity.buffer, f.db.buffer],
  })
}
