<template>
  <div class="flex gap-4">
    <button
      type="button"
      class="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
      @click="$emit('start')"
    >
      Start
    </button>
    <button
      type="button"
      class="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
      @click="$emit('stop')"
    >
      Stop
    </button>
  </div>
</template>

<script setup>
// keine extra Logik nötig, nur Events nach oben
</script>
