<template>
  <div class="scanner grid grid-cols-2 gap-4 p-4">
    <!-- Left: Camera + Depth -->
    <div class="flex flex-col gap-2">
      <CameraView ref="camera" />
      <DepthCanvas ref="depthCanvas" />
      <!-- <TSDFCanvas ref="tsdfCanvas" /> -->
    </div>

    <!-- Controls -->
    <UIControls @start="startCamera" @stop="stopCamera" />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import CameraView from "@/components/CameraView.vue";
import DepthCanvas from "@/components/DepthCanvas.vue";
import UIControls from "@/components/UIControls.vue";
import TSDFCanvas from "@/components/TSDFCanvas.vue";

import { initDepthEngine, runDepthEngine } from "@/composables/useDepthEngine";
import { uploadDepthToGPU } from "@/utils/webgpu-utils.js";
import { useTSDF } from "@/composables/useTSDF.js";

const camera = ref(null);
const depthCanvas = ref(null);
const tsdfCanvas = ref(null);

const tsdf = useTSDF();
let loopId = null;
let device = null;
let depthEngineSession = null;

// Helper to read a TSDF slice to CPU
async function readTSDFSliceToCPU(tsdfBuffer, gridSize, sliceZ) {
  const sliceSize = gridSize * gridSize * Float32Array.BYTES_PER_ELEMENT;
  const srcOffset = sliceZ * gridSize * gridSize * 8; // 8 bytes per voxel

  const readBuffer = device.createBuffer({
    size: sliceSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(tsdfBuffer, srcOffset, readBuffer, 0, sliceSize);
  device.queue.submit([encoder.finish()]);

  await readBuffer.mapAsync(GPUMapMode.READ);
  const arrayBuffer = readBuffer.getMappedRange();
  const tsdfSlice = new Float32Array(arrayBuffer.slice(0));
  readBuffer.unmap();

  return tsdfSlice;
}

onMounted(async () => {
  // Initialize ONNX session
  console.log("Initializing Depth Engine...");
  depthEngineSession = await initDepthEngine();
  console.log("Depth Engine initialized!");
});

async function startCamera() {
  // Initialize WebGPU device
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("Failed to get GPU adapter");
  device = await adapter.requestDevice();

  /*
  console.log("Initializing TSDF...");
  await tsdf.init(device);
*/
  console.log("Starting Camera...");
  await camera.value.startCamera();

  const loop = async () => {
    const frame = camera.value.captureFrame();
    if (frame && depthEngineSession) {
      // Run depth inference
      const depth = await runDepthEngine(frame);

  

      // Integrate into TSDF volume
     // await tsdf.integrate(device, depth.data, depth.width, depth.height);
      // Show depth map
      depthCanvas.value.update(depth.data, depth.width, depth.height);

      // Display middle TSDF slice
     /* const sliceZ = Math.floor(tsdf.gridSize / 2);
      const tsdfSlice = await readTSDFSliceToCPU(
        tsdf.tsdfBuffer(),
        tsdf.gridSize,
        sliceZ
      );
      tsdfCanvas.value.updateTSDFSlice(tsdfSlice, tsdf.gridSize); */
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
