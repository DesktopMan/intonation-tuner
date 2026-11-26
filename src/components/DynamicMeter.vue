<script setup lang="ts">
import { DYNAMIC_LEVELS, meterPosition, type Marking } from '@/audio/dynamics'

defineProps<{
  /** 0..1 position on the meter, or null if uncalibrated. */
  position: number | null
  marking: Marking | null
  /** dB offset from mf, for the small readout. */
  dbRelMf: number | null
  active: boolean
}>()

defineEmits<{ calibrate: [] }>()

const marks = DYNAMIC_LEVELS.map((l) => ({ ...l, pos: meterPosition(l.db) }))
</script>

<template>
  <div class="dyn">
    <template v-if="position != null">
      <div class="big" :class="{ inactive: !active || !marking }">
        <span class="marking">{{ marking ?? '—' }}</span>
        <span class="db dim" v-if="dbRelMf != null && marking">
          {{ dbRelMf >= 0 ? '+' : '' }}{{ dbRelMf.toFixed(0) }} dB
        </span>
      </div>
      <div class="bar" role="meter" aria-label="dynamic level" :aria-valuenow="position" aria-valuemin="0"
        aria-valuemax="1">
        <div class="fill" :style="{ height: `${position * 100}%` }" />
        <div v-for="m in marks" :key="m.marking" class="mark" :class="{ current: m.marking === marking }"
          :style="{ bottom: `${m.pos * 100}%` }">
          <span>{{ m.marking }}</span>
        </div>
        <div class="indicator" :style="{ bottom: `${position * 100}%` }" />
      </div>
      <button class="recal" @click="$emit('calibrate')">Recalibrate mf</button>
    </template>
    <div v-else class="uncalibrated">
      <p class="dim">Calibrate your mf to see dynamics.</p>
      <button class="primary" @click="$emit('calibrate')">Calibrate mf</button>
    </div>
  </div>
</template>

<style scoped>
.dyn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  min-width: 110px;
}
.big {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
}
.marking {
  font: italic 700 2.6rem/1 Georgia, 'Times New Roman', serif;
}
.db {
  font-size: 0.8rem;
  margin-top: 0.2rem;
}
.inactive {
  opacity: 0.35;
}
.bar {
  position: relative;
  width: 22px;
  height: 220px;
  border-radius: 11px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  margin-right: 34px;
}
.fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 11px;
  background: linear-gradient(to top, #3b5b8f, var(--accent));
  transition: height 60ms linear;
}
.mark {
  position: absolute;
  left: 100%;
  width: 34px;
  transform: translateY(50%);
  display: flex;
  align-items: center;
  font: italic 600 0.85rem Georgia, serif;
  color: var(--text-dim);
}
.mark::before {
  content: '';
  width: 6px;
  height: 1px;
  background: var(--text-dim);
  margin-right: 4px;
}
.mark.current {
  color: var(--text);
}
.indicator {
  position: absolute;
  left: -5px;
  right: -5px;
  height: 4px;
  border-radius: 2px;
  background: var(--text);
  transform: translateY(50%);
  transition: bottom 60ms linear;
}
.recal {
  font-size: 0.75rem;
  padding: 0.3em 0.6em;
}
.uncalibrated {
  text-align: center;
  max-width: 140px;
  font-size: 0.85rem;
}
</style>
