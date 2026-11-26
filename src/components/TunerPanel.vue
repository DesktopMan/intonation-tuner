<script setup lang="ts">
import { computed } from 'vue'
import CentsMeter from './CentsMeter.vue'
import DynamicMeter from './DynamicMeter.vue'
import { formatCents, tuneZone } from '@/audio/music'
import { useSettings } from '@/stores/settings'
import type { Tuner } from '@/composables/useTuner'

/**
 * Reusable tuner display. Owns no audio itself: pass in a tuner from useTuner()
 * so the parent can share it with feedback, calibration, recording etc.
 */
const props = withDefaults(
  defineProps<{
    tuner: Tuner
    /** Smaller layout without the dynamics meter (e.g. while recording). */
    compact?: boolean
    showDynamics?: boolean
  }>(),
  { compact: false, showDynamics: true },
)
defineEmits<{ calibrate: [] }>()

const { settings } = useSettings()
const zone = computed(() => (props.tuner.hasPitch ? tuneZone(props.tuner.cents, settings.tolerance) : null))
</script>

<template>
  <div class="tuner-panel card" :class="{ compact }">
    <div class="pitch">
      <div class="note" :class="[zone, { stale: !tuner.hasPitch }]">
        <template v-if="tuner.note">
          <span class="name">{{ tuner.note.name }}</span><sub class="octave">{{ tuner.note.octave }}</sub>
        </template>
        <span v-else class="name dim">–</span>
      </div>
      <div class="readout">
        <span class="cents" :class="zone">{{ tuner.hasPitch ? formatCents(tuner.cents) : '·' }}<small> ¢</small></span>
        <span class="dim freq">{{ tuner.freq > 0 ? tuner.freq.toFixed(1) : '—' }} Hz</span>
      </div>
      <CentsMeter :cents="tuner.cents" :active="tuner.hasPitch" :tolerance="settings.tolerance" :scale="!compact" />
      <p v-if="!tuner.running && !tuner.error" class="start">
        <button class="primary" @click="tuner.start()">Start listening</button>
      </p>
      <p v-if="tuner.error" class="error">{{ tuner.error }}</p>
    </div>
    <DynamicMeter v-if="showDynamics && !compact" :position="tuner.meterPos" :marking="tuner.marking"
      :db-rel-mf="tuner.dbRelMf" :active="tuner.running" @calibrate="$emit('calibrate')" />
  </div>
</template>

<style scoped>
.tuner-panel {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}
.pitch {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.note {
  font-size: 6rem;
  font-weight: 700;
  line-height: 1;
  transition: color 120ms;
}
.compact .note {
  font-size: 3rem;
}
.octave {
  font-size: 0.4em;
  font-weight: 500;
  vertical-align: baseline;
}
.note.stale {
  opacity: 0.4;
}
.readout {
  display: flex;
  gap: 1rem;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
}
.cents {
  font-size: 1.6rem;
  font-weight: 600;
  min-width: 4ch;
  text-align: right;
}
.compact .cents {
  font-size: 1.1rem;
}
.good {
  color: var(--good);
}
.warn {
  color: var(--warn);
}
.bad {
  color: var(--bad);
}
.freq {
  font-family: var(--mono);
  font-size: 0.9rem;
}
.start {
  margin: 0.5rem 0 0;
}
@media (max-width: 520px) {
  .tuner-panel:not(.compact) {
    gap: 0.75rem;
  }
  .note {
    font-size: 4.5rem;
  }
}
</style>
