import { initGPUBuffer, computeShader } from "@/utils/webgpu-utils.js";

/**
 * Simple TSDF integration for WebGPU
 */
export function useTSDF(gridSize = 128, voxelSize = 0.05, truncation = 0.1) {
  let tsdfBuffer = null;

  async function init(device) {
    const voxelCount = gridSize ** 3;

    // Each voxel: value (f32) + weight (f32) = 8 bytes
    tsdfBuffer = initGPUBuffer(device, voxelCount * 8, "storage");

    // Zero initialize TSDF
    const zeroData = new Float32Array(voxelCount * 2);
    device.queue.writeBuffer(tsdfBuffer, 0, zeroData);
  }

  /**
   * Integrate a single depth map into the TSDF volume
   */
  async function integrate(device, depthMap, width, height) {
    if (!tsdfBuffer) throw new Error("TSDF not initialized");

    const depthBuffer = initGPUBuffer(device, depthMap.byteLength, "storage");
    device.queue.writeBuffer(depthBuffer, 0, depthMap);

    const params = new Float32Array([voxelSize, gridSize, truncation, 0]);
    const paramsBuffer = initGPUBuffer(device, params.byteLength, "uniform");
    device.queue.writeBuffer(paramsBuffer, 0, params);

    const wh = new Float32Array([width, height]);
    const whBuffer = initGPUBuffer(device, wh.byteLength, "uniform");
    device.queue.writeBuffer(whBuffer, 0, wh);

    const wgSize = 8;
    const dispatchX = Math.ceil(gridSize / wgSize);
    const dispatchY = Math.ceil(gridSize / wgSize);
    const dispatchZ = Math.ceil(gridSize / wgSize);

    const bindings = [
      { binding: 0, resource: { buffer: tsdfBuffer } },
      { binding: 1, resource: { buffer: depthBuffer } },
      { binding: 2, resource: { buffer: paramsBuffer } },
      { binding: 3, resource: { buffer: whBuffer } },
    ];
    
    await computeShader(device, "/assets/shaders/tsdf-fusion.wgsl", bindings, dispatchX, dispatchY, dispatchZ);
  }

  return {
    init,
    integrate,
    tsdfBuffer: () => tsdfBuffer,
    gridSize,
  };
}
