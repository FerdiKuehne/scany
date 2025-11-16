<template>
    <div class="p-4 text-center">
      <h1 class="text-3xl font-bold mb-4">Welcome to Scany 3D Scanner</h1>
      <p class="mb-4">Use your webcam to generate real-time depth maps and 3D point clouds.</p>
      <NuxtLink to="/depth" class="btn">Start Scanning</NuxtLink>
    </div>
  </template>
  
  <script setup>
  </script>
  
  <style scoped>
  .btn {
    display: inline-block;
    padding: 0.5rem 1.5rem;
    background-color: #2563eb;
    color: white;
    border-radius: 0.25rem;
    text-decoration: none;
    font-weight: 600;
    transition: background 0.2s;
  }
  .btn:hover {
    background-color: #1d4ed8;
  }
  </style>
  