# Intonation Tuner

A browser-based (PWA) tuner and intonation trainer for solo instruments. See [docs/SPEC.md](docs/SPEC.md) for the full spec.

- **Tuner:** note, cents and Hz, plus a dynamics estimate (pp–ff) after a quick mf calibration. Optional audio feedback: a reference tone when you're out of tune, or a drone.
- **Intonation practice:** record a scale or a piece, then look through a zoomable timeline of every note's deviation from equal temperament and a per-note summary of your tendencies.

## Development

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev          # https://localhost:5173 (self-signed cert; the mic needs https)
bun run dev --host   # also expose on the LAN so you can test on a phone
bun run test         # unit + synthetic-signal analysis tests (Vitest)
bun run build        # type-check + production build into dist/
```

## Layout

| Path | Contents |
|---|---|
| `src/audio/` | Framework-free audio code: shared mic/AudioContext (`audioEngine`), pitch detection wrapper (`pitch`, uses pitchy), note math and transposition (`music`), loudness (`dynamics`), feedback tone, recorder worklet. |
| `src/analysis/` | Offline recording analysis (frames → note segments → stats), run in a Web Worker. |
| `src/composables/` | `useTuner` (the reusable live tuner), `useAudioFeedback`, `useMfCalibration`, `useRecorder`, `usePlayback`. |
| `src/components/` | `TunerPanel` (reusable tuner UI; pass it a `useTuner()` instance), meters, `IntonationTimeline` (ECharts), `NoteSummary`. |
| `src/stores/` | `settings` (persisted to localStorage) and `session` (in memory only: mf calibration and the last recording). |

### Reusing the tuner on a new screen

```vue
<script setup lang="ts">
import TunerPanel from '@/components/TunerPanel.vue'
import { useTuner } from '@/composables/useTuner'
const tuner = useTuner()          // stops automatically when the component unmounts
tuner.onFrame((f) => { /* raw per-frame pitch/level if you need it */ })
</script>
<template><TunerPanel :tuner="tuner" compact /></template>
```
