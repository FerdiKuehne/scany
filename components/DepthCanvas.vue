<template>
  <canvas ref="canvas" class="border"></canvas>
</template>

<script setup>
import { ref, onMounted, defineExpose } from "vue";

const canvas = ref(null);
let ctx = null;

// Display size (can match camera feed)
const displayWidth = 240;
const displayHeight = 240;

// Maximum expected depth in scene (meters)
const depthScale = 0.5;

onMounted(() => {
  if (canvas.value) {
    canvas.value.width = displayWidth;
    canvas.value.height = displayHeight;
    ctx = canvas.value.getContext("2d");
  }
});

/**
 * Draw a depth map on the canvas
 * @param {Float32Array} depthArray - 1D depth values
 * @param {number} width - width of depth map
 * @param {number} height - height of depth map
 */
async function update(depthArray, width, height) {
  try {
    if (!ctx || !depthArray || !width || !height) return;

    width = Number(width);
    height = Number(height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      console.warn("Invalid depth map dimensions", width, height);
      return;
    }

    // Create offscreen canvas at native depth resolution
    const offCanvas = document.createElement("canvas");
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext("2d");
    const imgData = offCtx.createImageData(width, height);


    // Fill image data using fixed depth scale
    for (let i = 0; i < depthArray.length; i++) {
      let val = depthArray[i];
      const normalized = val / depthScale;
      const shade = Math.floor(normalized * 255 ) * 0.1; // closer = brighter

      const idx = i * 4;
      imgData.data[idx + 0] = shade;
      imgData.data[idx + 1] = shade;
      imgData.data[idx + 2] = shade;
      imgData.data[idx + 3] = 255;
    }

    offCtx.putImageData(imgData, 0, 0);

    // Maintain aspect ratio
    const canvasAspect = canvas.value.width / canvas.value.height;
    const depthAspect = width / height;

    let drawWidth = canvas.value.width;
    let drawHeight = canvas.value.height;
    let offsetX = 0;
    let offsetY = 0;

    if (depthAspect > canvasAspect) {
      drawHeight = drawWidth / depthAspect;
      offsetY = (canvas.value.height - drawHeight) / 2;
    } else {
      drawWidth = drawHeight * depthAspect;
      offsetX = (canvas.value.width - drawWidth) / 2;
    }

    // Draw scaled depth map
    ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offCanvas, offsetX, offsetY, drawWidth, drawHeight);
  } catch (e) {
    console.error("DepthCanvas update error:", e);
    return;
  }
}

defineExpose({ update });
</script>

<style scoped>
canvas {
  border: 1px solid #333;
  image-rendering: pixelated; /* keeps pixels crisp */
  width: 256px;
  height: 256px;
}
</style>
