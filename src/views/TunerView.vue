<script setup lang="ts">
import { onMounted, ref } from 'vue'
import TunerPanel from '@/components/TunerPanel.vue'
import CalibrateMfDialog from '@/components/CalibrateMfDialog.vue'
import FeedbackControls from '@/components/FeedbackControls.vue'
import { useTuner } from '@/composables/useTuner'
import { useAudioFeedback } from '@/composables/useAudioFeedback'
import { useSettings } from '@/stores/settings'

const tuner = useTuner()
const { sounding } = useAudioFeedback(tuner)
const { settings } = useSettings()
const calibrating = ref(false)

// Browsers may require a user gesture before the mic/audio can start;
// in that case the panel shows a "Start listening" button instead.
onMounted(() => {
  if (navigator.userActivation?.hasBeenActive) void tuner.start()
})
</script>

<template>
  <div class="view">
    <header>
      <span class="dim">A4 = {{ settings.a4 }} Hz · {{ settings.instrumentKey === 'C' ? 'concert pitch' : `in ${settings.instrumentKey.replace('b', '♭')}` }}</span>
    </header>
    <TunerPanel :tuner="tuner" @calibrate="calibrating = true" />
    <FeedbackControls :sounding="sounding" />
    <div v-if="tuner.running" class="stop">
      <button @click="tuner.stop()">Stop listening</button>
    </div>
    <CalibrateMfDialog v-model:open="calibrating" :tuner="tuner" />
  </div>
</template>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
header {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  font-size: 0.85rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.stop {
  text-align: center;
}
</style>
