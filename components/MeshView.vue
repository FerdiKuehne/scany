<template>
  <canvas ref="canvas" class="border w-full h-auto"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineExpose } from "vue";

const canvas = ref(null);

let device = null;
let context = null;
let format = null;
let pipeline = null;
let vertexBuffer = null;
let indexBuffer = null;
let indexCount = 0;

// CPU-seitig gespeicherte Mesh-Daten
let baseVertices = null;        // Original-Vertices aus depthToMesh
let transformedVertices = null; // gedrehte / gescalte Vertices für die GPU

// Orbit-Kamera-Status
let isDragging = false;
let lastX = 0;
let lastY = 0;

// Yaw (Drehung um Y-Achse), Pitch (Drehung um X-Achse)
let cameraYaw = 0;                 // links/rechts
let cameraPitch = 0;               // hoch/runter
let zoomScale = 1.0;               // 1 = normal, <1 näher, >1 weiter weg
const minZoom = 0.3;
const maxZoom = 3.0;

// WGSL-Shader: einfache Projektion, feste Farbe
const shaderCode = /* wgsl */`
struct VSOut {
  @builtin(position) position : vec4<f32>,
};

@vertex
fn vs_main(@location(0) inPos : vec3<f32>) -> VSOut {
  var out : VSOut;

  let maxRange : f32 = 3.0;
  let x =  inPos.x / maxRange;
  let y = -inPos.y / maxRange;
  let z =  inPos.z / maxRange;

  out.position = vec4<f32>(x, y, z, 1.0);
  return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  // helles Drahtgitter
  return vec4<f32>(0.8, 0.8, 0.8, 1.0);
}
`;

// WebGPU Initialisierung
async function initWebGPU() {
  if (!navigator.gpu) {
    console.error("[MeshView] WebGPU not supported");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error("[MeshView] Failed to get GPU adapter");
    return;
  }

  device = await adapter.requestDevice();
  context = canvas.value.getContext("webgpu");
  format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: "opaque",
  });

  const shaderModule = device.createShaderModule({ code: shaderCode });

  pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 3 * 4, // 3 * float32
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3",
            },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: {
      // Drahtgitter: wir rendern Linien, nicht Dreiecke
      topology: "line-list",
      cullMode: "none",
    },
  });

  console.log("[MeshView] WebGPU ready");
}

// Dreiecks-Indices → Linien-Indices
function buildWireframeIndices(triIndices) {
  const tri = triIndices instanceof Uint32Array
    ? triIndices
    : new Uint32Array(triIndices);

  const triCount = tri.length / 3;
  const lineData = new Uint32Array(triCount * 6); // 3 Kanten * 2 Endpunkte
  let i = 0;

  for (let t = 0; t < triCount; t++) {
    const a = tri[3 * t + 0];
    const b = tri[3 * t + 1];
    const c = tri[3 * t + 2];

    // Kante AB
    lineData[i++] = a;
    lineData[i++] = b;

    // Kante BC
    lineData[i++] = b;
    lineData[i++] = c;

    // Kante CA
    lineData[i++] = c;
    lineData[i++] = a;
  }

  return lineData;
}

/**
 * Wendet Orbit-Rotation + Zoom auf die baseVertices an
 * und schreibt das Ergebnis in den GPU-Vertexbuffer.
 */
function updateTransformedVerticesAndUpload() {
  if (!device || !baseVertices || !context || !pipeline) return;

  const src = baseVertices;
  if (!transformedVertices || transformedVertices.length !== src.length) {
    transformedVertices = new Float32Array(src.length);
  }

  const cosY = Math.cos(cameraYaw);
  const sinY = Math.sin(cameraYaw);
  const cosX = Math.cos(cameraPitch);
  const sinX = Math.sin(cameraPitch);

  for (let i = 0; i < src.length; i += 3) {
    const x = src[i + 0];
    const y = src[i + 1];
    const z = src[i + 2];

    // Yaw um Y-Achse
    const x1 =  x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;

    // Pitch um X-Achse
    const y2 =  y * cosX - z1 * sinX;
    const z2 =  y * sinX + z1 * cosX;

    // Zoom
    transformedVertices[i + 0] = x1 * zoomScale;
    transformedVertices[i + 1] = y2 * zoomScale;
    transformedVertices[i + 2] = z2 * zoomScale;
  }

  const vByteLength = transformedVertices.byteLength;
  if (!vertexBuffer || vertexBuffer.size < vByteLength) {
    if (vertexBuffer && "destroy" in vertexBuffer) vertexBuffer.destroy();
    vertexBuffer = device.createBuffer({
      size: vByteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }

  device.queue.writeBuffer(
    vertexBuffer,
    0,
    transformedVertices.buffer,
    transformedVertices.byteOffset,
    transformedVertices.byteLength
  );
}

/**
 * Zeichnet den aktuellen Vertex/Index-Buffer
 */
function drawCurrentMesh() {
  if (!device || !context || !pipeline) return;
  if (!vertexBuffer || !indexBuffer || indexCount === 0) return;

  const encoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, vertexBuffer);
  pass.setIndexBuffer(indexBuffer, "uint32");
  pass.drawIndexed(indexCount, 1, 0, 0, 0);
  pass.end();

  device.queue.submit([encoder.finish()]);
}

/**
 * Wird von außen aufgerufen, wenn ein neues Mesh da ist.
 * vertices: Float32Array (x,y,z,...)
 * triIndices: Uint32Array (Dreiecks-Indices)
 */
function updateMesh(vertices, triIndices) {
  if (!device || !context || !pipeline) return;
  if (!vertices || !triIndices) return;

  const vData =
    vertices instanceof Float32Array ? vertices : new Float32Array(vertices);

  // baseVertices kopieren (Original-Mesh)
  baseVertices = new Float32Array(vData.length);
  baseVertices.set(vData);

  // Drahtgitter-Indices bauen
  const lineIndices = buildWireframeIndices(triIndices);
  indexCount = lineIndices.length;
  if (indexCount === 0) {
    clearCanvas();
    return;
  }

  // Index-Buffer
  const iByteLength = lineIndices.byteLength;
  if (!indexBuffer || indexBuffer.size < iByteLength) {
    if (indexBuffer && "destroy" in indexBuffer) indexBuffer.destroy();
    indexBuffer = device.createBuffer({
      size: iByteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
  }
  device.queue.writeBuffer(
    indexBuffer,
    0,
    lineIndices.buffer,
    lineIndices.byteOffset,
    lineIndices.byteLength
  );

  // Vertices transformieren & hochladen
  updateTransformedVerticesAndUpload();
  // und zeichnen
  drawCurrentMesh();
}

function clearCanvas() {
  if (!device || !context) return;
  const encoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  pass.end();
  device.queue.submit([encoder.finish()]);
}

// --- Orbit-Controls ---

function onMouseDown(evt) {
  if (!canvas.value) return;
  isDragging = true;
  lastX = evt.clientX;
  lastY = evt.clientY;
  canvas.value.style.cursor = "grabbing";
}

function onMouseMove(evt) {
  if (!isDragging) return;

  const dx = evt.clientX - lastX;
  const dy = evt.clientY - lastY;
  lastX = evt.clientX;
  lastY = evt.clientY;

  const rotSpeed = 0.005;
  cameraYaw += dx * rotSpeed;
  cameraPitch += dy * rotSpeed;

  const maxPitch = Math.PI / 2 - 0.1;
  if (cameraPitch > maxPitch) cameraPitch = maxPitch;
  if (cameraPitch < -maxPitch) cameraPitch = -maxPitch;

  updateTransformedVerticesAndUpload();
  drawCurrentMesh();
}

function onMouseUp() {
  if (!canvas.value) return;
  isDragging = false;
  canvas.value.style.cursor = "grab";
}

function onWheel(evt) {
  if (!canvas.value) return;
  evt.preventDefault();

  const zoomSpeed = 0.001;
  const delta = evt.deltaY;

  zoomScale *= 1 + delta * zoomSpeed;
  if (zoomScale < minZoom) zoomScale = minZoom;
  if (zoomScale > maxZoom) zoomScale = maxZoom;

  updateTransformedVerticesAndUpload();
  drawCurrentMesh();
}

function setupInteraction() {
  if (!canvas.value) return;

  canvas.value.style.cursor = "grab";

  canvas.value.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  canvas.value.addEventListener("wheel", onWheel, { passive: false });
}

function teardownInteraction() {
  if (!canvas.value) return;

  canvas.value.removeEventListener("mousedown", onMouseDown);
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
  canvas.value.removeEventListener("wheel", onWheel);
}

onMounted(() => {
  if (canvas.value) {
    canvas.value.width = 640;
    canvas.value.height = 480;
  }
  setupInteraction();
});

onBeforeUnmount(() => {
  teardownInteraction();

  if (vertexBuffer && "destroy" in vertexBuffer) vertexBuffer.destroy();
  if (indexBuffer && "destroy" in indexBuffer) indexBuffer.destroy();
  vertexBuffer = null;
  indexBuffer = null;
  device = null;
  context = null;
  pipeline = null;
});

// für Parent-Komponente
defineExpose({
  initWebGPU,
  updateMesh,
});
</script>

<style scoped>
canvas {
  border: 1px solid #333;
}
</style>
