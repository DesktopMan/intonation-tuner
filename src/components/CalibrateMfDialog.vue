<script setup lang="ts">
import { ref, watch } from 'vue'
import { CALIBRATION_MS, useMfCalibration } from '@/composables/useMfCalibration'
import type { Tuner } from '@/composables/useTuner'

const props = defineProps<{ tuner: Tuner }>()
const open = defineModel<boolean>('open', { required: true })

const dialog = ref<HTMLDialogElement>()
const { progress, status, calibrate, cancel } = useMfCalibration(props.tuner)

watch(open, (isOpen) => {
  if (isOpen) {
    dialog.value?.showModal()
    void run()
  } else {
    cancel()
    dialog.value?.close()
  }
})

async function run() {
  const ok = await calibrate()
  if (ok) setTimeout(() => (open.value = false), 700)
}
</script>

<template>
  <dialog ref="dialog" class="card" @close="open = false">
    <h2>Calibrate mf</h2>
    <p>
      Play a comfortable, sustained note at <em class="mf">mf</em> for about
      {{ CALIBRATION_MS / 1000 }} seconds. Stay at the distance from the device you'll practise at.
    </p>
    <div class="progress">
      <div class="bar" :style="{ width: `${progress * 100}%` }" />
    </div>
    <p class="status">
      <span v-if="status === 'listening'">{{ progress > 0 ? 'Keep playing…' : 'Listening — start playing' }}</span>
      <span v-else-if="status === 'done'" class="ok">Calibrated ✓</span>
      <span v-else-if="status === 'failed'" class="bad">
        Not enough clear sound detected.
        <button @click="run">Try again</button>
      </span>
    </p>
    <p class="dim small">
      The reading depends on microphone distance and register, so recalibrate if you move.
      Calibration is kept for this session only.
    </p>
    <div class="actions">
      <button @click="open = false">Cancel</button>
    </div>
  </dialog>
</template>

<style scoped>
dialog {
  color: var(--text);
  max-width: min(420px, 92vw);
}
dialog::backdrop {
  background: rgba(0, 0, 0, 0.6);
}
h2 {
  margin-top: 0;
}
.mf {
  font: italic 700 1.1em Georgia, serif;
}
.progress {
  height: 10px;
  border-radius: 5px;
  background: var(--surface-2);
  overflow: hidden;
}
.bar {
  height: 100%;
  background: var(--accent);
  transition: width 80ms linear;
}
.ok {
  color: var(--good);
}
.bad {
  color: var(--bad);
}
.small {
  font-size: 0.85rem;
}
.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
