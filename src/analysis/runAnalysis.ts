import type { AnalysisMessage, AnalysisRequest } from './analysis.worker'
import type { Analysis } from './types'

/** Analyse a recording in a Web Worker so the UI stays responsive. */
export function runAnalysis(req: AnalysisRequest, onProgress: (fraction: number) => void): Promise<Analysis> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<AnalysisMessage>) => {
      if (e.data.type === 'progress') onProgress(e.data.fraction)
      else {
        resolve(e.data.analysis)
        worker.terminate()
      }
    }
    worker.onerror = (e) => {
      reject(new Error(e.message || 'Analysis failed'))
      worker.terminate()
    }
    // Samples are copied (not transferred) because the recording is kept for playback.
    worker.postMessage(req)
  })
}
