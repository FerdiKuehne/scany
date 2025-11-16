<template>
  <div class="scanner grid grid-cols-2 gap-4 p-4">
    <!-- Left: Camera + Depth -->
    <div class="flex flex-col gap-2">
      <CameraView ref="camera" />
      <DepthCanvas ref="depthCanvas" />
    </div>

    <!-- Controls -->
    <UIControls @start="startCamera" @stop="stopCamera" />
  </div>
</template>

<script setup>
import { ref } from "vue";
import CameraView from "@/components/CameraView.vue";
import DepthCanvas from "@/components/DepthCanvas.vue";
import UIControls from "@/components/UIControls.vue";

import { useDepthEngine } from "@/composables/useDepthEngine";
import { uploadDepthToGPU } from "@/utils/webgpu-utils.js";

const camera = ref(null);
const depthCanvas = ref(null);

const depthEngine = useDepthEngine();
const tsdf = useTSDF();
let loopId = null;
let device = null;

async function startCamera() {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("Failed to get GPU adapter");
  device = await adapter.requestDevice();

  await depthEngine.init({ device: "webgpu" });
  await tsdf.init(device);
  await camera.value.startCamera();

  const loop = async () => {
  const frame = camera.value.captureFrame();
  if (frame) {
    const depth = await depthEngine.run(frame);
    const depthBuffer = uploadDepthToGPU(device, depth);
    await tsdf.integrate(device, depthBuffer);
    depthCanvas.value.update(depth.data, depth.width, depth.height);
  }
  loopId = requestAnimationFrame(loop);
};

  loopId = requestAnimationFrame(loop);
}

function stopCamera() {
  if (loopId) cancelAnimationFrame(loopId);
  camera.value.stopCamera();
}
</script>

<style scoped>
.scanner {
  height: 100vh;
}

canvas {
  border: 1px solid #333;
}
</style>
