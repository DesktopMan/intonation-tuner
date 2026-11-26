<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app">
    <header class="topbar">
      <nav class="modes" aria-label="Mode">
        <RouterLink to="/" class="mode">
          <span class="icon" aria-hidden="true">◉</span>
          Tuner
        </RouterLink>
        <RouterLink to="/practice" class="mode">
          <span class="icon" aria-hidden="true">〰</span>
          Intonation
        </RouterLink>
      </nav>
      <RouterLink to="/settings" class="settings" aria-label="Settings" title="Settings">⚙</RouterLink>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
  padding: calc(0.75rem + env(safe-area-inset-top)) 1rem 0.75rem;
  background: var(--bg);
}
.modes {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.mode {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  color: var(--text-dim);
  text-decoration: none;
  font-weight: 600;
  font-size: 1.05rem;
  transition:
    background 120ms,
    color 120ms;
}
.mode:hover {
  color: var(--text);
}
.mode.router-link-exact-active {
  background: var(--accent);
  color: #0b1220;
}
.icon {
  font-size: 1.15rem;
  line-height: 1;
}
.settings {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  flex: none;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  text-decoration: none;
  font-size: 1.35rem;
}
.settings:hover,
.settings.router-link-exact-active {
  color: var(--accent);
  border-color: var(--accent);
}
main {
  flex: 1;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 0.25rem 1rem 2rem;
}
</style>
