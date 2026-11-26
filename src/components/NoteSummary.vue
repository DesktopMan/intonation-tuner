<script setup lang="ts">
import { computed } from 'vue'
import { formatCents, pitchClassName, TRANSPOSITION, tuneZone, type NameOptions } from '@/audio/music'
import { dynamicInsight } from '@/analysis/stats'
import type { DynamicStat, GroupStat, Highlight, Summary } from '@/analysis/types'

const props = defineProps<{
  summary: Summary
  /** Intonation per dynamic marking, or null if mf isn't calibrated. */
  byDynamic: DynamicStat[] | null
  tolerance: number
  nameOptions: NameOptions
}>()
const highlight = defineModel<Highlight>('highlight', { default: null })
defineEmits<{ calibrate: [] }>()

interface Row extends GroupStat {
  key: string
  label: string
  italic: boolean
  select: NonNullable<Highlight>
}

function decorate(r: Row) {
  return {
    ...r,
    zone: tuneZone(r.meanCents, props.tolerance),
    // Bar from centre: ±50 cents maps to ±50% of the track.
    barLeft: 50 + Math.min(0, Math.max(-50, r.meanCents)),
    barWidth: Math.min(50, Math.abs(r.meanCents)),
  }
}

const noteRows = computed(() =>
  props.summary.byPitchClass.map((s) =>
    decorate({
      ...s,
      key: `pc${s.pc}`,
      label: pitchClassName(s.pc + TRANSPOSITION[props.nameOptions.instrumentKey], props.nameOptions.accidentals),
      italic: false,
      select: { kind: 'pc', pc: s.pc },
    }),
  ),
)

const dynamicRows = computed(() =>
  (props.byDynamic ?? []).map((s) =>
    decorate({ ...s, key: `dyn${s.marking}`, label: s.marking, italic: true, select: { kind: 'dyn', marking: s.marking } }),
  ),
)

const insight = computed(() => {
  if (!props.byDynamic) return null
  const i = dynamicInsight(props.byDynamic)
  if (!i) return { text: 'Play at a wider range of dynamics (at least two notes each) to compare.', notable: false }
  const amount = Math.abs(Math.round(i.diff))
  if (amount <= props.tolerance) {
    return {
      text: `Your intonation is consistent across dynamics: ${i.soft.marking} and ${i.loud.marking} are within ${amount} ¢ of each other.`,
      notable: false,
    }
  }
  return {
    text: `At ${i.soft.marking} you play ${amount} ¢ ${i.diff < 0 ? 'flatter' : 'sharper'} on average than at ${i.loud.marking} (${formatCents(i.soft.meanCents)} vs ${formatCents(i.loud.meanCents)} ¢).`,
    notable: true,
  }
})

const sameSelection = (a: Highlight, b: Highlight) => JSON.stringify(a) === JSON.stringify(b)
const isSelected = (r: Row) => sameSelection(highlight.value, r.select)
function toggle(r: Row) {
  highlight.value = isSelected(r) ? null : r.select
}
</script>

<template>
  <section class="card summary">
    <div class="tiles">
      <div class="tile">
        <span class="value">{{ summary.count }}</span>
        <span class="dim">notes</span>
      </div>
      <div class="tile">
        <span class="value">{{ summary.inTunePct.toFixed(0) }}%</span>
        <span class="dim">in tune (±{{ tolerance }} ¢)</span>
      </div>
      <div class="tile">
        <span class="value">{{ summary.meanAbsCents.toFixed(1) }} ¢</span>
        <span class="dim">average deviation</span>
      </div>
      <div class="tile">
        <span class="value">{{ formatCents(summary.meanCents) }} ¢</span>
        <span class="dim">overall tendency ({{ summary.meanCents > 1 ? 'sharp' : summary.meanCents < -1 ? 'flat' : 'centred' }})</span>
      </div>
    </div>

    <template v-for="section in [
      { title: 'By note', rows: noteRows, show: true },
      { title: 'By dynamic', rows: dynamicRows, show: byDynamic != null },
    ]" :key="section.title">
      <h3>{{ section.title }} <span v-if="section.show" class="dim hint">— tap a row to highlight it on the timeline</span></h3>

      <template v-if="section.title === 'By dynamic'">
        <p v-if="!byDynamic" class="notice calibrate">
          Calibrate your mf to see whether you go sharp or flat when playing soft or loud.
          <button class="primary" @click="$emit('calibrate')">Calibrate mf</button>
        </p>
        <p v-else-if="insight" class="insight" :class="{ notable: insight.notable }">{{ insight.text }}</p>
      </template>

      <table v-if="section.show">
        <thead>
          <tr>
            <th>{{ section.title === 'By note' ? 'Note' : 'Dynamic' }}</th>
            <th class="num">Count</th>
            <th class="num">Average</th>
            <th class="track-col">
              <span class="axis"><span>flat</span><span>sharp</span></span>
            </th>
            <th class="num range">Range</th>
            <th class="num">In tune</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in section.rows" :key="r.key"
            :class="{ selected: isSelected(r), faded: highlight != null && !isSelected(r) }" tabindex="0"
            @click="toggle(r)" @keydown.enter.space.prevent="toggle(r)">
            <td class="name" :class="{ marking: r.italic }">{{ r.label }}</td>
            <td class="num">{{ r.count }}</td>
            <td class="num">{{ formatCents(r.meanCents) }} ¢</td>
            <td class="track-col">
              <div class="track">
                <div class="center" />
                <div class="bar" :class="r.zone" :style="{ left: `${r.barLeft}%`, width: `${r.barWidth}%` }" />
              </div>
            </td>
            <td class="num dim range">{{ formatCents(r.minCents) }}…{{ formatCents(r.maxCents) }}</td>
            <td class="num">{{ r.inTune }}/{{ r.count }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </section>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.75rem;
}
.tile {
  display: flex;
  flex-direction: column;
}
.tile .value {
  font-size: 1.5rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.tile .dim {
  font-size: 0.8rem;
}
h3 {
  margin: 0.5rem 0 0;
  font-size: 1rem;
}
.hint {
  font-weight: 400;
  font-size: 0.8rem;
}
.calibrate {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0;
}
.insight {
  margin: 0;
  font-size: 0.95rem;
}
.insight.notable {
  font-weight: 600;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
}
th {
  text-align: left;
  font-weight: 500;
  color: var(--text-dim);
  font-size: 0.8rem;
  padding: 0.25rem 0.4rem;
}
td {
  padding: 0.35rem 0.4rem;
  border-top: 1px solid var(--border);
}
.num {
  text-align: right;
  white-space: nowrap;
}
.name {
  font-weight: 650;
}
.name.marking {
  font: italic 700 1.05rem Georgia, 'Times New Roman', serif;
}
tbody tr {
  cursor: pointer;
}
tbody tr:hover {
  background: var(--surface-2);
}
tr.selected {
  background: rgba(110, 168, 255, 0.12);
}
tr.faded {
  opacity: 0.5;
}
.track-col {
  width: 35%;
  min-width: 90px;
}
.axis {
  display: flex;
  justify-content: space-between;
}
.track {
  position: relative;
  height: 10px;
  background: var(--surface-2);
  border-radius: 5px;
}
.center {
  position: absolute;
  left: 50%;
  top: -3px;
  bottom: -3px;
  width: 1px;
  background: var(--text-dim);
}
.bar {
  position: absolute;
  top: 1px;
  bottom: 1px;
  min-width: 2px;
  border-radius: 4px;
}
.bar.good {
  background: var(--good);
}
.bar.warn {
  background: var(--warn);
}
.bar.bad {
  background: var(--bad);
}
@media (max-width: 520px) {
  .range {
    display: none;
  }
}
</style>
