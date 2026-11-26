# Intonation Tuner — Spec

## Context
The goal is a new, greenfield app for solo instrumentalists (`/home/cau/dev/intonation-tuner` is currently empty). It has two screens:
1. A **tuner** that also estimates **dynamics** (relative to a calibrated mf) and can give **audio feedback** so you don't have to watch it.
2. An **intonation practice** screen: record a scale or piece, then see every note's pitch deviation over time on a scrollable graph.

The tuner must be a reusable building block, because future screens will use it.

Decisions so far: Web app (PWA), **Vue 3** with TypeScript, 12-tone equal temperament with adjustable A4, a transposition setting, and results kept for the session only.


---

## Part A: Spec

### Global settings (persisted in localStorage)
- **A4 reference:** 415–466 Hz, default 440.
- **Instrument key:** C / B♭ / E♭ / F. This changes only the displayed note names (written pitch). All analysis is done in concert pitch.
- **Note naming:** sharps or flats.
- **"In tune" tolerance:** default ±5 cents (green). ±5–15 is yellow and >15 is red.

### Session state (memory only, lost on reload)
- **mf calibration:** the reference level in dBFS, captured once per session.
- **Last recording and its analysis.**

### Screen 1: Tuner
- **Large note name** with octave, e.g. `A4`.
- **Cents needle/strip** from −50 to +50, with colour zones.
- **Frequency readout** in Hz.
- **Stability:** the display is smoothed (median over about 5 frames) and is held or greyed out when no clear pitch is detected.
- **Calibrate mf**
  - The button opens a dialog: "Play a sustained note at mf for 3 s."
  - It takes the median RMS (in dB) of the voiced frames and stores it in the session store.
  - Until calibration is done, the dynamic meter shows a "Calibrate" prompt.
- **Dynamic meter**
  - A continuous vertical bar marked pp, p, mp, mf, f and ff.
  - An indicator shows the current level on that bar.
  - A big label shows the closest marking.
  - Default mapping, as dB offset from mf: pp −16, p −10, mp −5, mf 0, f +5, ff +10. Labels snap to the nearest marking.
  - Note in the UI: the reading depends on mic distance and register, so recalibrate if you move.
- **Audio feedback** (toggle plus mode select):
  - **Reference tone when off:** if a stable note is held for more than 300 ms and is outside tolerance, play that note's correct pitch softly. It fades out once you're back in tune.
  - **Drone:** play a continuous target note. You can choose either a fixed note (picker) or "follow nearest", which keeps the drone on the nearest note you're playing, with hysteresis so it doesn't flicker between notes.
  - Volume slider.
  - **Headphones are recommended (banner)**, because the mic hears the app's own tone. Mic input uses `echoCancellation/noiseSuppression/autoGainControl: false`, since auto gain control would break the dynamics reading.
- **Packaged as reusable building blocks:** `useTuner()` (composable) plus `<TunerPanel>` (composite component), both usable from any future screen.

### Screen 2: Intonation practice
- **Recording**
  - Record and Stop buttons, an elapsed-time display, and a live mini-tuner while recording, which reuses `useTuner`.
  - Maximum length 15 min, because raw audio is held in memory (about 11.5 MB/min at 48 kHz).
- **Analysis** runs in a Web Worker after Stop, with a progress indicator.
  1. **Frame-by-frame pitch:** a 10 ms hop and 2048-sample window, giving pitch, clarity and RMS for each frame.
  2. **Voiced frames:** a frame counts as voiced if clarity is ≥ 0.9 and RMS is above a noise gate.
  3. **Note segments:** runs of voiced frames on the same nearest semitone, with ±0.6 semitone hysteresis. Segments shorter than 80 ms are dropped. Gaps over 50 ms, or a jump of more than 1 semitone, split notes.
  4. **Per-note values:** for each segment, compute the median cents deviation of the steady part (skipping the first 60 ms of attack and the last 30 ms), plus duration, mean dB, and the dynamic marking if mf is calibrated.
- **Timeline visualisation** (the main view)
  - Interactive chart built with ECharts.
  - **x axis:** time. You can pan by dragging or swiping, zoom with the mouse wheel or a pinch, and use an overview slider underneath. The initial view shows about 10 s.
  - **y axis:** cents deviation from −50 to +50. The **centre line is perfect pitch**, with shaded ±tolerance bands.
  - The **pitch curve** is drawn per frame. Each note segment is a bar or curve coloured green, yellow or red.
  - Above each note is a text label with the note name (in written pitch) and its median deviation, e.g. `F#4 +12`. Labels that would overlap are hidden until you zoom in.
  - Hovering or tapping shows a tooltip with the note, cents, duration and dynamic.
  - Optional lower lane shows dynamics (dB vs mf). It shares the time axis with the pitch lane, so panning and zooming move both together.
  - Clicking a note plays that segment from the recording. A playback cursor follows during full playback.
- **Summary panel**
  - Overall % of notes in tune and mean absolute deviation.
  - A **per-pitch-class table**, e.g. "F♯: avg +14 ¢ across 9 occurrences, range +4…+22". This shows notes you tend to play out of tune throughout a piece.
  - Clicking a row highlights those notes on the timeline.

### Out of scope for v1
Just intonation and other temperaments, saved history, polyphonic input, score following.

---

## Tech choices

### Libraries

| Library | Purpose |
|---|---|
| `pitchy` | Pitch detection (McLeod pitch method). Small, no dependencies, and returns `[freq, clarity]`. Used by both the live tuner and the worker. It sits behind `audio/pitch.ts`, so the detector can be swapped later (e.g. for a custom YIN). |
| `pinia` | State management (settings store and session store). |
| `vue-router` | Navigation between screens. |
| `vite-plugin-pwa` | Makes the app installable and usable offline. |
| `@vitejs/plugin-basic-ssl` | HTTPS dev server for testing on a phone (microphone access requires a secure context). |
| `echarts` + `vue-echarts` | Intonation timeline chart. See the next section for why. Only the parts we use are imported (line and custom series, `dataZoom`, `markArea`, `markLine`, tooltip, canvas renderer), which keeps the bundle to roughly 300 KB minified. |
| `vitest` + `@vue/test-utils` + `happy-dom` | Tests, run with `bun run test`. Vitest is chosen over `bun test` because it reuses the Vite configuration. That means path aliases, `?worker` and `?url` (worklet) imports, and `.vue` compilation all work in tests with no extra setup. `bun test` cannot import `.vue` files without a custom plugin. |

Everything else uses what the browser provides: Web Audio API, `AudioWorklet` and Web Workers. The live tuner meters are plain SVG/CSS inside SFCs; a chart library would be overkill there.

### Why ECharts for the timeline
ECharts provides most of what the timeline needs out of the box:
- **Panning and zooming:** `dataZoom` supports the mouse wheel, drag, touch pinch and an overview slider.
- **Tolerance bands:** `markArea`.
- **Perfect-pitch centre line and playback cursor:** `markLine`.
- **Colouring by deviation:** `visualMap` (piecewise green/yellow/red).
- **Two lanes on one time axis:** two grids linked to the same `dataZoom`.
- **Overlapping labels:** `labelLayout.hideOverlap`.
- **Clicking a note:** click events, which trigger playback.
- **Long recordings:** a 15-minute recording is about 90k points, and `sampling: 'lttb'` keeps that fast.

Alternatives considered:
- **uPlot** is faster and smaller, but touch pan/zoom, labels and bands would all be hand-written.
- **Chart.js** needs its zoom plugin and is weaker with large time series.

The chart sits entirely inside `IntonationTimeline.vue`, so it could be replaced later without affecting the rest of the app.

