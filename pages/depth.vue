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

const camera = ref(null);
const depthCanvas = ref(null);

const depthEngine = useDepthEngine();
let loopId = null;

async function startCamera() {
  await depthEngine.init();
  await camera.value.startCamera();

  const loop = async () => {
    const frame = camera.value.captureFrame();
    if (!frame) {
      loopId = requestAnimationFrame(loop);
      return;
    }

    try {
      const depth = await depthEngine.run(frame);

      depthCanvas.value.update(
        depth.data,       // Float32Array
        depth.width,
        depth.height
      );
    } catch (e) {
      console.error("[Depth Error]", e);
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
