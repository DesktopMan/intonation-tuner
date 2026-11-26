<script setup lang="ts">
import { computed } from 'vue'
import { tuneZone } from '@/audio/music'

const props = withDefaults(
  defineProps<{
    cents: number
    active: boolean
    tolerance: number
    /** Show the numeric scale under the meter. */
    scale?: boolean
  }>(),
  { scale: true },
)

const W = 300
const H = 56
const RANGE = 50
const x = (c: number) => W / 2 + (Math.max(-RANGE, Math.min(RANGE, c)) / RANGE) * (W / 2)

const needleX = computed(() => x(props.active ? props.cents : 0))
const zone = computed(() => tuneZone(props.cents, props.tolerance))
const ticks = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50]
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H + (scale ? 16 : 0)}`" class="cents-meter" :class="{ inactive: !active }" role="img"
    :aria-label="active ? `${Math.round(cents)} cents` : 'no pitch'">
    <rect :x="0" :y="8" :width="W" :height="H - 16" rx="6" class="zone-bad" />
    <rect :x="x(-tolerance * 3)" :y="8" :width="x(tolerance * 3) - x(-tolerance * 3)" :height="H - 16" class="zone-warn" />
    <rect :x="x(-tolerance)" :y="8" :width="x(tolerance) - x(-tolerance)" :height="H - 16" class="zone-good" />
    <g v-for="t in ticks" :key="t">
      <line :x1="x(t)" :x2="x(t)" :y1="t === 0 ? 2 : 8" :y2="t === 0 ? H - 2 : t % 20 === 0 ? 16 : 13" class="tick"
        :class="{ center: t === 0 }" />
      <text v-if="scale && t % 10 === 0" :x="x(t)" :y="H + 12" class="label">{{ t > 0 ? `+${t}` : t }}</text>
    </g>
    <g class="needle" :class="zone" :style="{ transform: `translateX(${needleX}px)` }">
      <rect x="-3" y="4" width="6" :height="H - 8" rx="3" />
    </g>
  </svg>
</template>

<style scoped>
.cents-meter {
  width: 100%;
  display: block;
  overflow: visible;
}
.zone-bad {
  fill: rgba(208, 59, 59, 0.18);
}
.zone-warn {
  fill: rgba(250, 178, 25, 0.18);
}
.zone-good {
  fill: rgba(12, 163, 12, 0.35);
}
.tick {
  stroke: var(--text-dim);
  stroke-width: 1;
}
.tick.center {
  stroke: var(--text);
  stroke-width: 2;
}
.label {
  fill: var(--text-dim);
  font-size: 9px;
  text-anchor: middle;
}
.needle {
  transition: transform 80ms linear;
}
.needle.good rect {
  fill: var(--good);
}
.needle.warn rect {
  fill: var(--warn);
}
.needle.bad rect {
  fill: var(--bad);
}
.inactive .needle {
  opacity: 0.25;
}
</style>
