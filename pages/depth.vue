<template>
  <div class="scanner p-4 space-y-4">
    <!-- Oben: 2 Spalten mit allen Views -->
    <div class="grid md:grid-cols-2 gap-4">
      <!-- Links: Kamera + Depth -->
      <div class="flex flex-col gap-2">
        <CameraView ref="camera" />
        <DepthCanvas ref="depthCanvas" />
      </div>

      <!-- Rechts: Punktwolke + TSDF-Slice + Mesh -->
      <div class="flex flex-col gap-2">
        <PointCloudView ref="pointCloud" />
        <TSDFCanvas ref="tsdfCanvas" />
        <MeshView ref="meshView" />
      </div>
    </div>

    <!-- Unten: Controls -->
    <div class="flex justify-center">
      <UIControls @start="startCamera" @stop="stopCamera" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from "vue";

import CameraView from "@/components/CameraView.vue";
import DepthCanvas from "@/components/DepthCanvas.vue";
import UIControls from "@/components/UIControls.vue";
import TSDFCanvas from "@/components/TSDFCanvas.vue";
import PointCloudView from "@/components/PointCloudView.vue";
import MeshView from "@/components/MeshView.vue";

import { initDepthEngine, runDepthEngine } from "@/composables/useDepthEngine";
import { useTSDF } from "@/composables/useTSDF.js";
import { depthToPointCloud } from "@/utils/depthToPointCloud.js";
import { depthToMesh } from "@/utils/depthToMesh.js";

const camera = ref(null);
const depthCanvas = ref(null);
const tsdfCanvas = ref(null);
const pointCloud = ref(null);
const meshView = ref(null);

const tsdf = useTSDF();
let loopId = null;
let device = null;
let depthEngineSession = null;

// ---------- TUNING-BEREICH ----------

// Kamera-Parameter (kannst du anpassen)
const intrinsics = {
  fx: 250,               // Brennweite in Pixel X
  fy: 250,               // Brennweite in Pixel Y
  principalXOffset: 0,   // Verschiebung des Bildzentrums in X
  principalYOffset: 0,   // Verschiebung in Y
};

// Depth-Range in Metern (alles darunter/ darüber wird gekappt)
const depthRange = {
  min: 0.2,
  max: 3.0,
};

// Depth-Glättung aktivieren/deaktivieren
const enableDepthSmoothing = true;

// Mesh-Auflösung (größer = gröberes Drahtgitter)
const meshStep = 12; // 1 = voll, 2,4,8 = immer gröber

// ---------- ENDE TUNING ----------

// einfache Intrinsics (werden aus intrinsics gefüttert)
let fx = intrinsics.fx;
let fy = intrinsics.fy;
let cx = null;
let cy = null;

// Frame-Zähler für Throttling
let frameIndex = 0;
const integrateEvery = 2; // TSDF nur jedes 2. Frame integrieren
const sliceEvery = 6;     // TSDF-Slice und Mesh nur jedes 6. Frame

// Helper: TSDF-Slice vom GPU-Buffer zur CPU holen
async function readTSDFSliceToCPU(tsdfBuffer, gridSize, sliceZ) {
  const voxelsInSlice = gridSize * gridSize;

  // pro Voxel: vec2<f32> -> 8 Bytes
  const sliceBytes = voxelsInSlice * 8;
  const srcOffset = sliceZ * sliceBytes;

  const readBuffer = device.createBuffer({
    size: sliceBytes,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(tsdfBuffer, srcOffset, readBuffer, 0, sliceBytes);
  device.queue.submit([encoder.finish()]);

  await readBuffer.mapAsync(GPUMapMode.READ);
  const arrayBuffer = readBuffer.getMappedRange();

  // fullSlice: [val0, w0, val1, w1, ...]
  const fullSlice = new Float32Array(arrayBuffer.slice(0));
  readBuffer.unmap();

  // nur die Werte extrahieren
  const values = new Float32Array(voxelsInSlice);
  for (let i = 0, j = 0; i < voxelsInSlice; i++, j += 2) {
    values[i] = fullSlice[j];
  }

  return values;
}

/**
 * Depth-Preprocessing:
 * - clamp auf [min,max]
 * - optional 3x3-Glättung, die nur gültige (nicht-0) Nachbarn mittelt
 */
function preprocessDepth(src, width, height) {
  const n = src.length;
  const clamped = new Float32Array(n);

  const minD = depthRange.min;
  const maxD = depthRange.max;

  // 1) clamp & invalid → 0
  for (let i = 0; i < n; i++) {
    const d = src[i];
    if (!Number.isFinite(d) || d <= minD) {
      clamped[i] = 0;
    } else if (d > maxD) {
      clamped[i] = maxD;
    } else {
      clamped[i] = d;
    }
  }

  if (!enableDepthSmoothing) {
    return clamped;
  }

  // 2) einfacher 3x3-Boxblur (nur über gültige Nachbarn)
  const dst = new Float32Array(n);

  const w = width;
  const h = height;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;

      for (let ky = -1; ky <= 1; ky++) {
        const ny = y + ky;
        if (ny < 0 || ny >= h) continue;

        for (let kx = -1; kx <= 1; kx++) {
          const nx = x + kx;
          if (nx < 0 || nx >= w) continue;

          const idx = ny * w + nx;
          const d = clamped[idx];
          if (d > 0) {
            sum += d;
            count++;
          }
        }
      }

      const idxCenter = y * w + x;
      if (count === 0) {
        // keine gültigen Nachbarn -> Wert bleibt 0 (invalid)
        dst[idxCenter] = 0;
      } else {
        dst[idxCenter] = sum / count;
      }
    }
  }

  return dst;
}

onMounted(async () => {
  // Depth Engine initialisieren
  console.log("Initializing Depth Engine...");
  depthEngineSession = await initDepthEngine();
  console.log("Depth Engine initialized!");

  await nextTick();

  // PointCloud-WebGPU initialisieren
  if (pointCloud.value) {
    console.log("[depth] init WebGPU for point cloud");
    await pointCloud.value.initWebGPU();
  }

  // Mesh-WebGPU initialisieren
  if (meshView.value) {
    console.log("[depth] init WebGPU for mesh view");
    await meshView.value.initWebGPU();
  }
});

async function startCamera() {
  // WebGPU-Device für TSDF & Compute
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("Failed to get GPU adapter");
  device = await adapter.requestDevice();

  console.log("[TSDF] Initializing TSDF volume...");
  await tsdf.init(device);
  console.log("[TSDF] TSDF volume initialized");

  console.log("Starting Camera...");
  await camera.value.startCamera();

  frameIndex = 0;

  const loop = async () => {
    frameIndex++;

    const frame = camera.value.captureFrame();
    if (frame && depthEngineSession) {
      // 1) Depth inference
      const depth = await runDepthEngine(frame);
      console.log(
        "[loop] depth size",
        depth.width,
        depth.height,
        depth.data.length
      );

      const width = depth.width;
      const height = depth.height;

      // 2) Depth vorverarbeiten (clamp + optional smoothing)
      const filteredDepth = preprocessDepth(depth.data, width, height);

      // 3) Depth Map anzeigen (gefiltert)
      depthCanvas.value.update(filteredDepth, width, height);

      // 4) cx/cy einmalig setzen
      if (cx === null || cy === null) {
        cx = width / 2 + intrinsics.principalXOffset;
        cy = height / 2 + intrinsics.principalYOffset;
        console.log("[depth] intrinsics:", { fx, fy, cx, cy });
      }

      // 5) Depth → Punktwolke (gefiltert)
      const points = depthToPointCloud(
        filteredDepth,
        width,
        height,
        fx,
        fy,
        cx,
        cy
      );
      console.log("[loop] points count", points.length / 3);

      if (pointCloud.value) {
        pointCloud.value.updatePointCloud(points);
      }

      // 6) Depth → Mesh (gefiltert, gedrosselt)
      if (meshView.value && frameIndex % sliceEvery === 0) {
        const { vertices, indices } = depthToMesh(
          filteredDepth,
          width,
          height,
          fx,
          fy,
          cx,
          cy,
          meshStep        // <--- grobe/fine Meshauflösung
        );
        meshView.value.updateMesh(vertices, indices);
      }

      // 7) TSDF-Integration (gefiltert, gedrosselt)
      if (frameIndex % integrateEvery === 0) {
        await tsdf.integrate(device, filteredDepth, width, height);
      }

      // 8) Mittel-Slice aus TSDF anzeigen (gedrosselt)
      if (tsdfCanvas.value && frameIndex % sliceEvery === 0) {
        const sliceZ = Math.floor(tsdf.gridSize / 2);
        const tsdfSlice = await readTSDFSliceToCPU(
          tsdf.tsdfBuffer(),
          tsdf.gridSize,
          sliceZ
        );
        console.log(
          "[TSDF] slice read z=" + sliceZ,
          "len=" + tsdfSlice.length,
          "example=",
          tsdfSlice[0]
        );
        tsdfCanvas.value.updateTSDFSlice(tsdfSlice, tsdf.gridSize);
      }
    }

    loopId = requestAnimationFrame(loop);
  };

  loopId = requestAnimationFrame(loop);
}

function stopCamera() {
  if (loopId) cancelAnimationFrame(loopId);
  loopId = null;
  camera.value.stopCamera();
}
</script>

<style scoped>
.scanner {
  min-height: 100vh;
}

canvas {
  border: 1px solid #333;
}
</style>
