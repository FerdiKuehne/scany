<template>
  <canvas ref="canvas" class="border"></canvas>
</template>

<script setup>
import { ref, defineExpose } from "vue";

const canvas = ref(null);

function update(depthArray, width, height) {
  if (!canvas.value) return;

  canvas.value.width = width;
  canvas.value.height = height;

  const ctx = canvas.value.getContext("2d");
  const img = ctx.createImageData(width, height);

  let min = Infinity, max = -Infinity;
  for (let v of depthArray) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  for (let i = 0; i < depthArray.length; i++) {
    const n = (depthArray[i] - min) / (max - min);
    const g = n * 255;

    img.data[i * 4 + 0] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
}

defineExpose({ update });
</script>
