<template>
  <div>
    <canvas ref="canvas" class="border w-full h-auto"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, defineExpose } from "vue";

const canvas = ref(null);
let device, context;

async function initWebGPU() {
  if (!navigator.gpu) throw new Error("WebGPU not supported");
  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();
  context = canvas.value.getContext("webgpu");

  context.configure({
    device,
    format: "bgra8unorm",
    alphaMode: "opaque",
  });

  return { device, context };
}

function draw(vertexBuffer, count) {
  if (!device || !context) return;

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: "clear",
      storeOp: "store",
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
  });

  pass.end();
  device.queue.submit([encoder.finish()]);
}

onMounted(() => {
  if (canvas.value) {
    canvas.value.width = 640;
    canvas.value.height = 480;
  }
});

defineExpose({
  initWebGPU,
  draw,
  canvas
});
</script>



<style scoped>
canvas {
  border: 1px solid #333;
}
</style>
