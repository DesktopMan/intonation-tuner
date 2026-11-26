import { createRouter, createWebHashHistory } from 'vue-router'
import TunerView from './views/TunerView.vue'

export const router = createRouter({
  // Hash history keeps the PWA working from any static host without rewrites.
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'tuner', component: TunerView, meta: { title: 'Tuner' } },
    {
      path: '/practice',
      name: 'practice',
      component: () => import('./views/IntonationView.vue'),
      meta: { title: 'Intonation' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./views/SettingsView.vue'),
      meta: { title: 'Settings' },
    },
  ],
})
