<script setup lang="ts">
import { computed } from 'vue'
import { noteName } from '@/audio/music'
import { useSettings, type FeedbackMode } from '@/stores/settings'

defineProps<{
  /** Concert MIDI note currently sounding, if any. */
  sounding: number | null
}>()

const store = useSettings()
const settings = store.settings

const modes: { value: FeedbackMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'reference', label: 'Reference tone' },
  { value: 'drone', label: 'Drone' },
]

/** Drone choices: C2..C6 concert, labelled in written pitch. */
const droneNotes = computed(() =>
  Array.from({ length: 49 }, (_, i) => 36 + i).map((midi) => ({ midi, label: noteName(midi, store.nameOptions).label })),
)

const droneSelect = computed({
  get: () => String(settings.droneTarget),
  set: (v: string) => (settings.droneTarget = v === 'follow' ? 'follow' : Number(v)),
})
</script>

<template>
  <section class="card feedback">
    <div class="row">
      <h3>Audio feedback</h3>
      <div class="segmented" role="radiogroup" aria-label="Audio feedback mode">
        <button v-for="m in modes" :key="m.value" role="radio" :aria-checked="settings.feedbackMode === m.value"
          :class="{ active: settings.feedbackMode === m.value }" @click="settings.feedbackMode = m.value">
          {{ m.label }}
        </button>
      </div>
    </div>

    <template v-if="settings.feedbackMode !== 'off'">
      <p class="dim help" v-if="settings.feedbackMode === 'reference'">
        When you hold a note that's out of tune, the correct pitch plays so you can tune to it by ear. It stops when you're in tune, or a couple of seconds after you stop playing.
      </p>
      <p class="dim help" v-else>A sustained note to tune against.</p>

      <div class="row controls">
        <label v-if="settings.feedbackMode === 'drone'">
          Drone
          <select v-model="droneSelect">
            <option value="follow">Follow my playing</option>
            <option v-for="n in droneNotes" :key="n.midi" :value="String(n.midi)">{{ n.label }}</option>
          </select>
        </label>
        <label class="volume">
          Volume
          <input v-model.number="settings.feedbackVolume" type="range" min="0" max="1" step="0.05" />
        </label>
        <span class="sounding" :class="{ on: sounding != null }">
          ♪ {{ sounding != null ? noteName(sounding, store.nameOptions).label : 'silent' }}
        </span>
      </div>
      <p class="notice">🎧 Use headphones: otherwise the microphone hears the feedback tone and the tuner gets confused.</p>
    </template>
  </section>
</template>

<style scoped>
.feedback {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
h3 {
  margin: 0;
  font-size: 1rem;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.controls {
  justify-content: flex-start;
}
label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.help {
  margin: 0;
  font-size: 0.9rem;
}
.notice {
  margin: 0;
}
.sounding {
  margin-left: auto;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}
.sounding.on {
  color: var(--accent);
}
</style>
