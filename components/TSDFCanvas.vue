<template>
  <canvas ref="canvas" class="border w-full h-auto"></canvas>
</template>

<script setup>
import { ref, onMounted, defineExpose } from "vue";

const canvas = ref(null);
let ctx = null;

// Anzeigegröße
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
 * Zeichnet eine TSDF-Slice, interpretiert Werte als "Tiefe" (>=0).
 * @param {Float32Array} tsdfSlice - 1D array von Länge gridSize*gridSize
 * @param {number} gridSize - Breite/Höhe der Slice
 */
function updateTSDFSlice(tsdfSlice, gridSize) {
  if (!ctx || !tsdfSlice) return;

  // 1) min/max für positive Werte bestimmen (ignoriere <= 0)
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let i = 0; i < tsdfSlice.length; i++) {
    const v = tsdfSlice[i];
    if (!Number.isFinite(v) || v <= 0) continue;
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }

  // Fallback, falls alles 0 oder <=0 ist
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || minVal === maxVal) {
    minVal = 0;
    maxVal = 1;
  }

  // 2) kleines Canvas für das TSDF-Gitter
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = gridSize;
  tempCanvas.height = gridSize;
  const tempCtx = tempCanvas.getContext("2d");
  const imageData = tempCtx.createImageData(gridSize, gridSize);

  for (let i = 0; i < tsdfSlice.length; i++) {
    const v = tsdfSlice[i];
    let shade = 0;

    if (Number.isFinite(v) && v > 0) {
      // norm: 0 = nah (minVal), 1 = weit (maxVal)
      const norm = Math.min(Math.max((v - minVal) / (maxVal - minVal), 0), 1);
      // nah -> hell, weit -> dunkel
      shade = Math.floor((1 - norm) * 255);
    } else {
      // 0 oder ungültig = schwarz
      shade = 0;
    }

    const offset = i * 4;
    imageData.data[offset + 0] = shade;
    imageData.data[offset + 1] = shade;
    imageData.data[offset + 2] = shade;
    imageData.data[offset + 3] = 255;
  }

  tempCtx.putImageData(imageData, 0, 0);

  // 3) auf das große Canvas skalieren
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tempCanvas, 0, 0, canvas.value.width, canvas.value.height);
}

// expose für parent
defineExpose({
  canvas,
  updateTSDFSlice,
});
</script>

<style scoped>
canvas {
  border: 1px solid #333;
  image-rendering: pixelated;
  width: 640px;
  height: 480px;
}
</style>
