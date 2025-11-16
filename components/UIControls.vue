<template>
    <div class="controls flex gap-2 mt-2">
      <button @click="$emit('start')"
              class="btn">Start Camera</button>
      <button @click="$emit('stop')"
              class="btn">Stop Camera</button>
      <button @click="$emit('reset')"
              class="btn">Reset TSDF</button>
    </div>
  </template>
  
  <script setup>
  </script>
  
  <style scoped>
  .controls {
    display: flex;
    gap: 0.5rem;
  }
  .btn {
    padding: 0.5rem 1rem;
    background-color: #1f2937;
    color: white;
    border-radius: 0.25rem;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn:hover {
    background-color: #374151;
  }
  </style>
  