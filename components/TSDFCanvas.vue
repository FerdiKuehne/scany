<template>
    <canvas ref="canvas" class="border w-full h-auto"></canvas>
  </template>
  
  <script setup>
  import { ref, onMounted, defineExpose, watch } from "vue";
  
  const canvas = ref(null);
  let ctx = null;
  
  // Optional: target display size (match your video/depth canvas)
  const displayWidth = 640;
  const displayHeight = 480;
  
  onMounted(() => {
    if (canvas.value) {
      canvas.value.width = displayWidth;
      canvas.value.height = displayHeight;
      ctx = canvas.value.getContext("2d");
    }
  });
  
  /**
   * Draw a single TSDF slice on the canvas
   * @param {Float32Array} tsdfSlice - 1D array of size gridSize*gridSize
   * @param {number} gridSize - width/height of slice
   */
  function updateTSDFSlice(tsdfSlice, gridSize) {
    if (!ctx || !tsdfSlice) return;
  
    // create a temporary image for the small TSDF grid
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = gridSize;
    tempCanvas.height = gridSize;
    const tempCtx = tempCanvas.getContext("2d");
    const imageData = tempCtx.createImageData(gridSize, gridSize);
  
    const threshold = 0.0005; // surface threshold
  
    for (let i = 0; i < tsdfSlice.length; i++) {
      const val = tsdfSlice[i];
      // gradient visualization: bright near surface, darker far from surface
      let shade = 0;
      if (Math.abs(val) < threshold) {
        // near surface → white
        shade = 255;
      } else {
        // farther → map linearly to gray
        const norm = Math.min(Math.abs(val) / 1, 1); // assume TSDF ~ -1..1
        shade = Math.floor((1 - norm) * 128); // mid-gray
      }
  
      const offset = i * 4;
      imageData.data[offset + 0] = shade;
      imageData.data[offset + 1] = shade;
      imageData.data[offset + 2] = shade;
      imageData.data[offset + 3] = 255;
    }
  
    tempCtx.putImageData(imageData, 0, 0);
  
    // scale the small grid to full display canvas
    ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
    ctx.drawImage(tempCanvas, 0, 0, canvas.value.width, canvas.value.height);
  }
  
  // expose for parent component
  defineExpose({
    canvas,
    updateTSDFSlice,
  });
  </script>
  
  <style scoped>
  canvas {
    border: 1px solid #333;
    image-rendering: pixelated; /* makes each voxel crisp */
    width: 640px;   /* match depth camera display width */
    height: 480px;  /* match depth camera display height */
  }
  </style>
  