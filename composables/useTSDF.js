import { initGPUBuffer, computeShader } from "@/utils/webgpu-utils";

export function useTSDF(gridSize = 128, voxelSize = 0.05) {
  let tsdfBuffer = null;

  async function init(device) {
    tsdfBuffer = initGPUBuffer(device, gridSize ** 3 * 8, "storage");
  }

  async function integrate(device, depthMap) {
    if (!tsdfBuffer) throw new Error("TSDF buffer not initialized");

    const params = new Float32Array([voxelSize, gridSize, 0.1, 0.0]);
    const paramsBuffer = initGPUBuffer(device, params.byteLength, "storage");
    device.queue.writeBuffer(paramsBuffer, 0, params);

    await computeShader(
      device,
      "/shaders/tsdf-fusion.wgsl",
      {
        tsdfGrid: tsdfBuffer,
        depthMap,
        params: paramsBuffer
      },
      gridSize / 8,
      gridSize / 8,
      gridSize / 8
    );
  }

  return { init, integrate, tsdfBuffer: () => tsdfBuffer };
}
