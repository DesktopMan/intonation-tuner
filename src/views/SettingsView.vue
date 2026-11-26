<script setup lang="ts">
import { INSTRUMENT_KEY_LABELS, type InstrumentKey } from '@/audio/music'
import { useSettings } from '@/stores/settings'
import { useSession } from '@/stores/session'

const store = useSettings()
const settings = store.settings
const session = useSession()

const keys = Object.keys(INSTRUMENT_KEY_LABELS) as InstrumentKey[]

function clampA4() {
  settings.a4 = Math.min(466, Math.max(415, Math.round((settings.a4 || 440) * 10) / 10))
}
</script>

<template>
  <div class="view">
    <h1>Settings</h1>

    <section class="card">
      <h2>Tuning</h2>
      <label class="row">
        <span>Reference A4</span>
        <span><input v-model.number="settings.a4" type="number" min="415" max="466" step="0.5" @change="clampA4" /> Hz</span>
      </label>
      <label class="row">
        <span>In-tune tolerance</span>
        <span><input v-model.number="settings.tolerance" type="range" min="2" max="15" step="1" /> ±{{ settings.tolerance }} ¢</span>
      </label>
      <p class="dim help">Equal temperament. Notes within the tolerance are shown green; up to 3× the tolerance yellow; beyond that red.</p>
    </section>

    <section class="card">
      <h2>Note names</h2>
      <label class="row">
        <span>Instrument key</span>
        <select v-model="settings.instrumentKey">
          <option v-for="k in keys" :key="k" :value="k">{{ INSTRUMENT_KEY_LABELS[k] }}</option>
        </select>
      </label>
      <div class="row">
        <span>Accidentals</span>
        <div class="segmented">
          <button :class="{ active: settings.accidentals === 'sharps' }" @click="settings.accidentals = 'sharps'">♯ Sharps</button>
          <button :class="{ active: settings.accidentals === 'flats' }" @click="settings.accidentals = 'flats'">♭ Flats</button>
        </div>
      </div>
      <p class="dim help">Transposing instruments see note names in written pitch. Analysis always uses concert pitch.</p>
    </section>

    <section class="card">
      <h2>Dynamics</h2>
      <div class="row">
        <span>mf calibration (this session)</span>
        <span v-if="session.mfDb != null">
          {{ session.mfDb.toFixed(1) }} dBFS
          <button @click="session.mfDb = null">Clear</button>
        </span>
        <span v-else class="dim">Not calibrated — use the Tuner tab</span>
      </div>
      <label class="row">
        <span>Show dynamics lane in intonation results</span>
        <input v-model="settings.showDynamicsLane" type="checkbox" />
      </label>
    </section>

    <div>
      <button @click="store.reset()">Reset to defaults</button>
    </div>
  </div>
</template>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
h1 {
  margin: 0;
  font-size: 1.4rem;
}
h2 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
input[type='number'] {
  width: 6em;
}
.help {
  margin: 0;
  font-size: 0.85rem;
}
</style>
