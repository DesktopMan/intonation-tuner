<script setup lang="ts">
import { ref, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { CustomChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapPiecewiseComponent,
} from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import VChart from 'vue-echarts'
import type { EChartsOption, CustomSeriesRenderItem } from 'echarts'
import { DYNAMIC_LEVELS, nearestMarking } from '@/audio/dynamics'
import { formatCents, noteName, tuneZone, type NameOptions } from '@/audio/music'
import { noteCurve } from '@/analysis/stats'
import type { Analysis, Note } from '@/analysis/types'

use([
  CanvasRenderer,
  LineChart,
  ScatterChart,
  CustomChart,
  GridComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapPiecewiseComponent,
  LabelLayout,
])

const props = defineProps<{
  analysis: Analysis
  tolerance: number
  nameOptions: NameOptions
  /** Calibrated mf in dBFS, or null. */
  mfDb: number | null
  showDynamics: boolean
  /** Notes to emphasise (others are dimmed), or null for all. */
  highlightIds: ReadonlySet<number> | null
  /** Playback position in seconds, or null. */
  cursor: number | null
}>()
const emit = defineEmits<{ noteClick: [note: Note] }>()

// Status palette (validated for colour-vision deficiency on the dark surface).
const ZONE_COLOR = { good: '#0ca30c', warn: '#fab219', bad: '#d03b3b' }
const TEXT = '#e8eaed'
const TEXT_DIM = '#9aa1ad'
const GRID_LINE = 'rgba(255,255,255,0.07)'
const INITIAL_SPAN = 12

type VChartInstance = InstanceType<typeof VChart>
const chart = ref<VChartInstance>()
/** Visible time window, kept across rebuilds and used to follow the cursor. */
let view: [number, number] = [0, Math.min(props.analysis.duration, INITIAL_SPAN)]

const clampCents = (c: number) => Math.max(-50, Math.min(50, c))
const mmss = (t: number) => {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(s % 1 ? 1 : 0)}`
}
const isDimmed = (n: Note) => props.highlightIds != null && !props.highlightIds.has(n.id)

function noteData() {
  return props.analysis.notes.map((n) => [n.start, n.end, clampCents(n.cents), n.id, isDimmed(n) ? 1 : 0])
}

function labelData() {
  return props.analysis.notes.map((n) => {
    const c = clampCents(n.cents)
    return {
      value: [(n.start + n.end) / 2, c],
      name: `${noteName(n.midi, props.nameOptions).label}\n${formatCents(n.cents)}`,
      label: { show: !isDimmed(n), position: c > 25 ? 'bottom' : 'top' },
    }
  })
}

const renderNote: CustomSeriesRenderItem = (_params, api) => {
  const start = api.coord([api.value(0), api.value(2)])
  const end = api.coord([api.value(1), api.value(2)])
  const cents = Number(api.value(2))
  const dimmed = api.value(4) === 1
  return {
    type: 'rect',
    shape: { x: start[0], y: start[1] - 4, width: Math.max(3, end[0] - start[0] - 2), height: 8, r: 4 },
    style: { fill: ZONE_COLOR[tuneZone(cents, props.tolerance)], opacity: dimmed ? 0.2 : 0.95 },
  }
}

function tooltipFor(n: Note): string {
  const name = noteName(n.midi, props.nameOptions).label
  const zone = tuneZone(n.cents, props.tolerance)
  const zoneText = zone === 'good' ? 'in tune' : n.cents > 0 ? 'sharp' : 'flat'
  const dyn = props.mfDb != null ? ` · <i>${nearestMarking(n.meanDb - props.mfDb)}</i>` : ''
  return `<b>${name}</b> ${formatCents(n.cents)} ¢ (${zoneText})<br/>${mmss(n.start)} · ${((n.end - n.start) * 1000).toFixed(0)} ms${dyn}<br/><span style="opacity:.7">Tap to play</span>`
}

function buildOption(): EChartsOption {
  const a = props.analysis
  const f = a.frames
  const t = props.tolerance
  const hasDyn = props.showDynamics

  // Pitch curve: frames of each note, relative to that note; null breaks the line between notes.
  const curve: [number, number | null][] = []
  for (const n of a.notes) {
    for (const [i, c] of noteCurve(f, n, a.a4, a.gateDb)) curve.push([f.times[i], c])
    curve.push([f.times[n.endFrame] + f.hopSec, null])
  }

  // Dynamics lane: level relative to mf if calibrated, else dBFS.
  const ref = props.mfDb ?? 0
  const dyn: [number, number | null][] = []
  if (hasDyn) {
    let prevOn = false
    for (let i = 0; i < f.times.length; i++) {
      const on = f.db[i] > a.gateDb
      if (on) dyn.push([f.times[i], f.db[i] - ref])
      else if (prevOn) dyn.push([f.times[i], null])
      prevOn = on
    }
  }

  const xAxisIdx = hasDyn ? [0, 1] : [0]
  const xAxisBase = {
    type: 'value' as const,
    min: 0,
    max: a.duration,
    axisLine: { lineStyle: { color: TEXT_DIM } },
    axisLabel: { color: TEXT_DIM, formatter: (v: number) => mmss(v) },
    splitLine: { lineStyle: { color: GRID_LINE } },
  }

  return {
    animation: false,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'system-ui, sans-serif' },
    grid: [
      { left: 48, right: 20, top: 34, bottom: hasDyn ? 196 : 70 },
      ...(hasDyn ? [{ left: 48, right: 20, height: 108, bottom: 62 }] : []),
    ],
    xAxis: [
      { ...xAxisBase, gridIndex: 0, axisLabel: { ...xAxisBase.axisLabel, show: !hasDyn } },
      ...(hasDyn ? [{ ...xAxisBase, gridIndex: 1 }] : []),
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        min: -50,
        max: 50,
        interval: 25,
        name: 'cents',
        nameTextStyle: { color: TEXT_DIM, align: 'right' },
        axisLabel: { color: TEXT_DIM, formatter: (v: number) => (v > 0 ? `+${v}` : `${v}`) },
        splitLine: { lineStyle: { color: GRID_LINE } },
      },
      ...(hasDyn
        ? [
            {
              type: 'value' as const,
              gridIndex: 1,
              min: props.mfDb != null ? -22 : -70,
              max: props.mfDb != null ? 15 : 0,
              name: props.mfDb != null ? 'dynamic' : 'dBFS',
              nameTextStyle: { color: TEXT_DIM, align: 'right' as const },
              axisLabel: props.mfDb != null ? { show: false } : { color: TEXT_DIM },
              splitLine: { show: false },
            },
          ]
        : []),
    ],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: xAxisIdx,
        filterMode: 'none',
        startValue: view[0],
        endValue: view[1],
        minValueSpan: 1,
      },
      {
        type: 'slider',
        xAxisIndex: xAxisIdx,
        filterMode: 'none',
        startValue: view[0],
        endValue: view[1],
        minValueSpan: 1,
        height: 22,
        bottom: 12,
        borderColor: 'transparent',
        backgroundColor: 'rgba(255,255,255,0.04)',
        fillerColor: 'rgba(110,168,255,0.18)',
        textStyle: { color: TEXT_DIM },
        labelFormatter: (v: number) => mmss(v),
        dataBackground: { lineStyle: { color: TEXT_DIM, opacity: 0.4 }, areaStyle: { opacity: 0 } },
      },
    ],
    visualMap: {
      type: 'piecewise',
      show: false,
      seriesIndex: 0,
      dimension: 1,
      pieces: [
        // ±0.5 matches tuneZone(), which rounds to whole cents.
        { lt: -3 * t - 0.5, color: ZONE_COLOR.bad },
        { gte: -3 * t - 0.5, lt: -t - 0.5, color: ZONE_COLOR.warn },
        { gte: -t - 0.5, lt: t + 0.5, color: ZONE_COLOR.good },
        { gte: t + 0.5, lt: 3 * t + 0.5, color: ZONE_COLOR.warn },
        { gte: 3 * t + 0.5, color: ZONE_COLOR.bad },
      ],
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: '#262a31',
      borderColor: '#343944',
      textStyle: { color: TEXT },
      formatter: (p) => {
        const params = Array.isArray(p) ? p[0] : p
        const note = props.analysis.notes[params.dataIndex]
        return params.seriesId === 'notes' && note ? tooltipFor(note) : ''
      },
    },
    series: [
      {
        id: 'pitch',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: curve,
        showSymbol: false,
        connectNulls: false,
        silent: true,
        lineStyle: { width: 1.5, opacity: 0.55 },
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(12,163,12,0.10)' },
          data: [[{ yAxis: -t }, { yAxis: t }]],
        },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: TEXT_DIM, type: 'solid', width: 1 },
          data: [{ yAxis: 0 }],
        },
      },
      {
        id: 'notes',
        type: 'custom',
        xAxisIndex: 0,
        yAxisIndex: 0,
        renderItem: renderNote,
        encode: { x: [0, 1], y: 2 },
        data: noteData(),
        clip: true,
        cursor: 'pointer',
      },
      {
        id: 'labels',
        type: 'scatter',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: labelData(),
        symbolSize: 1,
        itemStyle: { color: 'transparent' },
        cursor: 'pointer',
        clip: true,
        tooltip: { show: false },
        label: {
          show: true,
          formatter: '{b}',
          color: TEXT,
          fontSize: 11,
          lineHeight: 13,
          distance: 8,
          align: 'center',
        },
        labelLayout: { hideOverlap: true },
        emphasis: { disabled: true },
      },
      {
        id: 'cursor',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: [],
        silent: true,
        markLine: {
          silent: true,
          symbol: 'none',
          animation: false,
          label: { show: false },
          lineStyle: { color: '#6ea8ff', width: 2, type: 'solid' },
          data: props.cursor != null ? [{ xAxis: props.cursor }] : [],
        },
      },
      ...(hasDyn
        ? [
            {
              id: 'dynamics',
              type: 'line' as const,
              xAxisIndex: 1,
              yAxisIndex: 1,
              data: dyn,
              showSymbol: false,
              connectNulls: false,
              silent: true,
              lineStyle: { width: 1, color: '#6ea8ff' },
              areaStyle: { color: 'rgba(110,168,255,0.12)', origin: 'start' as const },
              markLine:
                props.mfDb != null
                  ? {
                      silent: true,
                      symbol: 'none',
                      lineStyle: { color: GRID_LINE, type: 'dashed' as const },
                      label: {
                        position: 'start' as const,
                        formatter: '{b}',
                        color: TEXT_DIM,
                        fontStyle: 'italic' as const,
                        fontFamily: 'Georgia, serif',
                      },
                      data: DYNAMIC_LEVELS.map((l) => ({ name: l.marking, yAxis: l.db })),
                    }
                  : undefined,
            },
          ]
        : []),
    ],
  } as EChartsOption
}

const initialOption = buildOption()

function rebuild() {
  chart.value?.setOption(buildOption(), true)
}

watch(() => [props.analysis, props.tolerance, props.nameOptions, props.mfDb, props.showDynamics], rebuild)

watch(
  () => props.highlightIds,
  () =>
    chart.value?.setOption({
      series: [
        { id: 'notes', data: noteData() },
        { id: 'labels', data: labelData() },
      ],
    }),
)

watch(
  () => props.cursor,
  (t) => {
    chart.value?.setOption({ series: [{ id: 'cursor', markLine: { data: t != null ? [{ xAxis: t }] : [] } }] }, false, true)
    // Keep the cursor in view while playing.
    if (t != null && (t > view[1] || t < view[0])) {
      const span = view[1] - view[0]
      const start = Math.max(0, Math.min(props.analysis.duration - span, t - span * 0.1))
      chart.value?.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, startValue: start, endValue: start + span })
      view = [start, start + span]
    }
  },
)

interface ZoomEvent {
  start?: number
  end?: number
  batch?: { start?: number; end?: number }[]
}

function onDataZoom(payload: object) {
  const e = payload as ZoomEvent
  const z = e.batch?.[0] ?? e
  if (z.start == null || z.end == null) return
  const d = props.analysis.duration
  view = [(z.start / 100) * d, (z.end / 100) * d]
}

function onClick(e: { seriesId?: string; dataIndex: number }) {
  if (e.seriesId !== 'notes' && e.seriesId !== 'labels') return
  const note = props.analysis.notes[e.dataIndex]
  if (note) emit('noteClick', note)
}
</script>

<template>
  <div class="timeline" :class="{ 'with-dyn': showDynamics }">
    <VChart ref="chart" :option="initialOption" manual-update autoresize @click="onClick" @datazoom="onDataZoom" />
  </div>
</template>

<style scoped>
.timeline {
  width: 100%;
  height: 380px;
}
.timeline.with-dyn {
  height: 510px;
}
</style>
