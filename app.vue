<template>
  <div id="app" class="app-container">
    <NuxtPage />
  </div>
</template>

<script setup>
</script>

<style>
/* Full-page reset */
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  font-family: 'Inter', sans-serif;
  background-color: #1e1e1e;
  color: #f3f4f6;
}

/* Scrollbar styling (optional) */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-thumb {
  background-color: #374151;
  border-radius: 4px;
}
::-webkit-scrollbar-track {
  background-color: #111827;
}

/* Global canvas style */
canvas {
  display: block;
  max-width: 100%;
  height: auto;
  background-color: #111827;
}
</style>
