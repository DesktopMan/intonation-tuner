<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import TunerPanel from '@/components/TunerPanel.vue'
import IntonationTimeline from '@/components/IntonationTimeline.vue'
import NoteSummary from '@/components/NoteSummary.vue'
import CalibrateMfDialog from '@/components/CalibrateMfDialog.vue'
import { useTuner } from '@/composables/useTuner'
import { MAX_RECORDING_SEC, useRecorder } from '@/composables/useRecorder'
import { usePlayback } from '@/composables/usePlayback'
import { runAnalysis } from '@/analysis/runAnalysis'
import { noteMarking, summarize, summarizeByDynamic } from '@/analysis/stats'
import type { Highlight, Note } from '@/analysis/types'
import { useSettings } from '@/stores/settings'
import { useSession, type Recording } from '@/stores/session'

const settingsStore = useSettings()
const settings = settingsStore.settings
const session = useSession()

const tuner = useTuner()
const recorder = useRecorder({ onAutoStop: (rec) => void finishRecording(rec) })
const playback = usePlayback()

const analyzing = ref(false)
const progress = ref(0)
const analysisError = ref<string | null>(null)
const highlight = ref<Highlight>(null)
const calibrating = ref(false)

const summary = computed(() => (session.analysis ? summarize(session.analysis.notes, settings.tolerance) : null))
// Dynamics are derived at display time, so calibrating after recording updates the results.
const byDynamic = computed(() =>
  session.analysis && session.mfDb != null
    ? summarizeByDynamic(session.analysis.notes, session.mfDb, settings.tolerance)
    : null,
)
const highlightIds = computed<ReadonlySet<number> | null>(() => {
  const h = highlight.value
  if (!h || !session.analysis) return null
  const mf = session.mfDb
  const match = (n: Note) =>
    h.kind === 'pc' ? ((n.midi % 12) + 12) % 12 === h.pc : mf != null && noteMarking(n, mf) === h.marking
  return new Set(session.analysis.notes.filter(match).map((n) => n.id))
})

// Calibration borrows this screen's tuner; release the mic again afterwards.
watch(calibrating, (open) => {
  if (!open && !recorder.recording.value) tuner.stop()
})
watch(
  () => session.mfDb,
  (mf) => {
    if (mf == null && highlight.value?.kind === 'dyn') highlight.value = null
  },
)

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

async function startRecording() {
  playback.stop()
  analysisError.value = null
  await tuner.start()
  await recorder.start()
  if (!recorder.recording.value) tuner.stop()
}

async function stopRecording() {
  const rec = await recorder.stop()
  if (rec) await finishRecording(rec)
}

async function finishRecording(rec: Recording) {
  tuner.stop()
  if (rec.samples.length < rec.sampleRate * 0.3) {
    analysisError.value = 'That recording was too short.'
    return
  }
  session.recording = rec
  session.analysis = null
  highlight.value = null
  analyzing.value = true
  progress.value = 0
  try {
    session.analysis = await runAnalysis(
      { samples: rec.samples, sampleRate: rec.sampleRate, a4: settings.a4 },
      (p) => (progress.value = p),
    )
  } catch (e) {
    analysisError.value = e instanceof Error ? e.message : String(e)
  } finally {
    analyzing.value = false
  }
}

async function reanalyze() {
  if (session.recording) await finishRecording(session.recording)
}

function playNote(n: Note) {
  if (session.recording) playback.play(session.recording, n.start - 0.05, n.end + 0.05)
}

function togglePlayAll() {
  if (playback.playing.value) playback.stop()
  else if (session.recording) playback.play(session.recording, 0)
}

function discard() {
  playback.stop()
  session.recording = null
  session.analysis = null
}
</script>

<template>
  <div class="view">
    <section class="card controls">
      <template v-if="recorder.recording.value">
        <button class="danger big" @click="stopRecording">■ Stop</button>
        <span class="rec"><span class="dot" /> Recording {{ fmt(recorder.elapsed.value) }}</span>
        <span class="dim small">max {{ MAX_RECORDING_SEC / 60 }} min</span>
      </template>
      <template v-else>
        <button class="primary big" :disabled="analyzing" @click="startRecording">
          ● {{ session.recording ? 'New recording' : 'Record' }}
        </button>
        <span class="dim small" v-if="!session.recording">Play a scale or a whole piece, then press Stop.</span>
        <template v-if="session.analysis">
          <button @click="togglePlayAll">{{ playback.playing.value ? '■ Stop playback' : '▶ Play recording' }}</button>
          <button v-if="session.analysis.a4 !== settings.a4" @click="reanalyze">Re-analyse at A4 = {{ settings.a4 }}</button>
          <button class="discard" @click="discard">Discard</button>
        </template>
      </template>
    </section>

    <section v-if="session.mfDb == null && !recorder.recording.value && !analyzing" class="notice reminder">
      <span>
        <strong>Dynamics aren't calibrated.</strong>
        Calibrate your <em class="mf">mf</em> to see whether your intonation changes when you play soft or loud.
        <template v-if="session.analysis">Your results update straight away.</template>
        <template v-else>Do it at the distance from the microphone you'll record at.</template>
      </span>
      <button class="primary" @click="calibrating = true">Calibrate mf</button>
    </section>

    <p v-if="recorder.error.value" class="error">{{ recorder.error.value }}</p>
    <p v-if="analysisError" class="error">{{ analysisError }}</p>

    <TunerPanel v-if="recorder.recording.value" :tuner="tuner" compact />

    <section v-if="analyzing" class="card analyzing">
      <span>Analysing… {{ Math.round(progress * 100) }}%</span>
      <div class="progress"><div class="bar" :style="{ width: `${progress * 100}%` }" /></div>
    </section>

    <template v-if="session.analysis && !analyzing && !recorder.recording.value">
      <p v-if="session.analysis.notes.length === 0" class="notice">
        No clear notes were found. Try playing closer to the microphone, or check the input level on the Tuner tab.
      </p>
      <template v-else>
        <section class="card chart-card">
          <div class="legend">
            <span><i class="sw good" /> in tune (±{{ settings.tolerance }} ¢)</span>
            <span><i class="sw warn" /> slightly off</span>
            <span><i class="sw bad" /> out of tune (&gt;{{ settings.tolerance * 3 }} ¢)</span>
            <span class="dim">Centre line = perfect pitch · scroll/pinch to zoom · tap a note to hear it</span>
          </div>
          <IntonationTimeline :analysis="session.analysis" :tolerance="settings.tolerance"
            :name-options="settingsStore.nameOptions" :mf-db="session.mfDb" :show-dynamics="settings.showDynamicsLane"
            :highlight-ids="highlightIds" :cursor="playback.position.value" @note-click="playNote" />
          <p v-if="settings.showDynamicsLane && session.mfDb == null" class="dim small">
            The lower lane shows raw level until mf is calibrated.
          </p>
        </section>
        <NoteSummary v-if="summary" v-model:highlight="highlight" :summary="summary" :by-dynamic="byDynamic"
          :tolerance="settings.tolerance" :name-options="settingsStore.nameOptions" @calibrate="calibrating = true" />
      </template>
    </template>

    <CalibrateMfDialog v-model:open="calibrating" :tuner="tuner" />
  </div>
</template>

<style scoped>
.reminder {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
}
.mf {
  font: italic 700 1.05em Georgia, serif;
}
.view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
.big {
  font-size: 1.1rem;
  padding: 0.65em 1.4em;
}
.discard {
  margin-left: auto;
}
.small {
  font-size: 0.85rem;
}
.rec {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--bad);
  animation: pulse 1s infinite alternate;
}
@keyframes pulse {
  to {
    opacity: 0.3;
  }
}
.analyzing {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.progress {
  height: 8px;
  border-radius: 4px;
  background: var(--surface-2);
  overflow: hidden;
}
.progress .bar {
  height: 100%;
  background: var(--accent);
}
.chart-card {
  padding: 0.75rem 0.5rem 0.5rem;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  font-size: 0.8rem;
  padding: 0 0.5rem;
}
.sw {
  display: inline-block;
  width: 14px;
  height: 8px;
  border-radius: 4px;
  vertical-align: middle;
  margin-right: 2px;
}
.sw.good {
  background: var(--good);
}
.sw.warn {
  background: var(--warn);
}
.sw.bad {
  background: var(--bad);
}
</style>
