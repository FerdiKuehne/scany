import { computeShader, createVertexBuffer } from "@/utils/webgpu-utils";

export function usePointCloud(gridSize = 128) {
  let vertexBuffer = null;

  function init(device) {
    // Create a Float32Array for vertices (x, y, z per voxel)
    const numVertices = gridSize ** 3;
    const vertices = new Float32Array(numVertices * 3); // x,y,z for each voxel

    // Initialize vertex buffer
    vertexBuffer = createVertexBuffer(device, vertices);
  }

  async function render(device, tsdfBuffer, viewProjMatrix) {
    if (!vertexBuffer) return;

    await computeShader(device, "pointcloud-render.wgsl", {
      tsdfGrid: tsdfBuffer,
      vertexBuffer,
      viewProj: viewProjMatrix,
    });
  }

  return { init, vertexBuffer, render };
}
