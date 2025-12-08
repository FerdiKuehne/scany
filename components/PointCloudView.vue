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
let pointCount = 0;

// WGSL-Shader: nimmt vec3-Position und färbt nach Tiefe
const shaderCode = /* wgsl */`
struct VSOut {
  @builtin(position) position : vec4<f32>,
  @location(0) vDepth : f32,
};

@vertex
fn vs_main(@location(0) inPos : vec3<f32>) -> VSOut {
  var out : VSOut;

  // sehr simple "Kamera": skaliert alles in Clipspace
  let maxRange : f32 = 3.0;
  let x =  inPos.x / maxRange;
  let y = -inPos.y / maxRange;           // y invertieren für "oben ist oben"
  let z =  (inPos.z / maxRange);

  out.position = vec4<f32>(x, y, z, 1.0);
  out.vDepth   = inPos.z;
  return out;
}

@fragment
fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
  let maxRange : f32 = 3.0;
  let t = clamp(in.vDepth / maxRange, 0.0, 1.0);

  // ganz nah = blau, weit weg = rot
  return vec4<f32>(t, 1.0 - t, 1.0, 1.0);
}
`;

// Einmalig WebGPU initialisieren
async function initWebGPU() {
  console.log("[PointCloudView] initWebGPU called");

  if (!navigator.gpu) {
    console.error("[PointCloudView] WebGPU not supported in this browser");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error("[PointCloudView] Failed to get GPU adapter");
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
      topology: "point-list",
    },
  });

  console.log("[PointCloudView] WebGPU ready");
}

// Punktwolke aktualisieren und zeichnen
function updatePointCloud(points) {
  if (!device || !context || !pipeline || !points) {
    console.warn("[PointCloudView] updatePointCloud: missing state", {
      device: !!device,
      context: !!context,
      pipeline: !!pipeline,
      hasPoints: !!points,
    });
    return;
  }

  const data =
    points instanceof Float32Array ? points : new Float32Array(points);

  pointCount = data.length / 3;
  console.log("[PointCloudView] draw pointCount =", pointCount);

  if (pointCount === 0) {
    clearCanvas();
    return;
  }

  // Buffer anlegen / vergrößern falls nötig
  if (!vertexBuffer || vertexBuffer.size < data.byteLength) {
    if (vertexBuffer && "destroy" in vertexBuffer) {
      vertexBuffer.destroy();
    }
    vertexBuffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }

  // Daten in den Buffer schreiben
  device.queue.writeBuffer(
    vertexBuffer,
    0,
    data.buffer,
    data.byteOffset,
    data.byteLength
  );

  // Renderpass
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
  pass.draw(pointCount, 1, 0, 0);
  pass.end();

  device.queue.submit([encoder.finish()]);
}

// Nur löschen, ohne Punkte zu zeichnen
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

onMounted(() => {
  if (canvas.value) {
    canvas.value.width = 640;
    canvas.value.height = 480;
  }
});

onBeforeUnmount(() => {
  if (vertexBuffer && "destroy" in vertexBuffer) {
    vertexBuffer.destroy();
  }
  vertexBuffer = null;
  device = null;
  context = null;
  pipeline = null;
});

// für Eltern-Komponente zugänglich machen
defineExpose({
  initWebGPU,
  updatePointCloud,
});
</script>

<style scoped>
canvas {
  border: 1px solid #333;
}
</style>
