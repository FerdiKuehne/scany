// composables/useTSDF.js
// Sehr einfache "TSDF"-Implementierung:
// - 3D-Volume (gridSize^3) mit (value, weight) pro Voxel
// - pro Integrationsschritt schreiben wir die Depthmap in die *mittlere Z-Slice*
// - wir mitteln über mehrere Frames (running average)
// => die mittlere Slice ist ein grobes Depthbild (N x N)

import { ref } from "vue";

export function useTSDF() {
  const gridSize = 32; // klein halten für Performance

  let tsdfBuffer = null;
  let depthBuffer = null;
  let paramsBuffer = null;
  let pipeline = null;
  let bindGroup = null;

  const initialized = ref(false);

  // WGSL-Compute-Shader:
  // - läuft über Pixel (width x height)
  // - liest depthMap[idx]
  // - mappt (u,v) auf (gx,gy) im TSDF-Grid
  // - schreibt in die mittlere Z-Slice (gz = N/2)
  // - value = gemittelte Tiefe
  const tsdfIntegrateWGSL = /* wgsl */`
struct Params {
  width    : f32,
  height   : f32,
  gridSize : f32,
  _pad0    : f32,
};

@group(0) @binding(0)
var<storage, read_write> tsdfVolume : array<vec2<f32>>; // x=value, y=weight

@group(0) @binding(1)
var<storage, read> depthMap : array<f32>;

@group(0) @binding(2)
var<uniform> params : Params;

// Workgroup: 8x8 Pixel
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let w  : u32 = u32(params.width);
  let h  : u32 = u32(params.height);
  let Nf : f32 = params.gridSize;
  let N  : u32 = u32(Nf);

  if (gid.x >= w || gid.y >= h) {
    return;
  }

  let idx : u32 = gid.y * w + gid.x;
  let d   : f32 = depthMap[idx];

  // Ungültige Tiefen ignorieren
  if (!(d > 0.0)) {
    return;
  }

  // (u,v) -> (gx,gy) im Grid
  let fx : f32 = f32(gid.x);
  let fy : f32 = f32(gid.y);
  let fw : f32 = max(params.width - 1.0, 1.0);
  let fh : f32 = max(params.height - 1.0, 1.0);

  let gx : u32 = u32(round(fx / fw * (Nf - 1.0)));
  let gy : u32 = u32(round(fy / fh * (Nf - 1.0)));
  let gz : u32 = N / 2u;

  if (gx >= N || gy >= N || gz >= N) {
    return;
  }

  let voxelIndex : u32 = gz * N * N + gy * N + gx;

  // Running average: value = mittlere Tiefe, weight = Anzahl der Samples
  let old      = tsdfVolume[voxelIndex];
  let oldVal   : f32 = old.x;
  let oldW     : f32 = old.y;
  let newW     : f32 = oldW + 1.0;
  let newVal   : f32 = (oldVal * oldW + d) / newW;

  tsdfVolume[voxelIndex] = vec2<f32>(newVal, newW);
}
`;

  async function init(device) {
    if (initialized.value) return;

    console.log("[useTSDF] init DEPTH TSDF, gridSize =", gridSize);

    const voxelCount = gridSize * gridSize * gridSize;

    // TSDF-Buffer: (value, weight) als vec2<f32> → 8 Bytes pro Voxel
    tsdfBuffer = device.createBuffer({
      size: voxelCount * 8,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |  // wichtig für readTSDFSliceToCPU
        GPUBufferUsage.COPY_DST,
    });

    // initial mit 0 füllen
    const initialData = new Float32Array(voxelCount * 2);
    device.queue.writeBuffer(tsdfBuffer, 0, initialData.buffer);

    // Depth-Buffer: max 256x256 Float32 reicht für deinen 252x252-Output
    const maxDepthPixels = 256 * 256;
    depthBuffer = device.createBuffer({
      size: maxDepthPixels * 4, // bytes
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Uniform-Buffer (width, height, gridSize, padding)
    paramsBuffer = device.createBuffer({
      size: 4 * 4, // 4 float32 = 16 Bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({
      code: tsdfIntegrateWGSL,
    });

    pipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
    });

    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: tsdfBuffer } },
        { binding: 1, resource: { buffer: depthBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
      ],
    });

    initialized.value = true;
    console.log("[useTSDF] DEPTH TSDF init complete");
  }

  /**
   * Integrate: Depthmap ins Volume "reinbacken".
   * Die mittlere Z-Slice enthält ein geglättetes Depthbild.
   */
  async function integrate(device, depthData, width, height) {
    if (!initialized.value || !pipeline || !bindGroup) {
      console.warn("[useTSDF] integrate called before init");
      return;
    }

    const depthArray =
      depthData instanceof Float32Array
        ? depthData
        : new Float32Array(depthData);

    const pixelCount = width * height;
    const byteLength = pixelCount * 4;

    // Depth in GPU-Buffer schieben
    device.queue.writeBuffer(
      depthBuffer,
      0,
      depthArray.buffer,
      depthArray.byteOffset,
      byteLength
    );

    // Params updaten (als floats)
    const paramsArray = new Float32Array([
      width,
      height,
      gridSize,
      0, // padding
    ]);
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray.buffer);

    // Compute-Pass
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);

    const workgroupSizeX = 8;
    const workgroupSizeY = 8;

    const workgroupsX = Math.ceil(width / workgroupSizeX);
    const workgroupsY = Math.ceil(height / workgroupSizeY);

    pass.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
    pass.end();

    device.queue.submit([encoder.finish()]);
  }

  function tsdfBufferHandle() {
    return tsdfBuffer;
  }

  return {
    gridSize,
    init,
    integrate,
    tsdfBuffer: tsdfBufferHandle,
  };
}
