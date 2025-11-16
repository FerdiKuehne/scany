export function initGPUBuffer(device, size, usage) {
  return device.createBuffer({
    size,
    usage:
      usage === "storage"
        ? GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        : GPUBufferUsage.UNIFORM,
  });
}

export async function computeShader(device, shaderPath, bindings, x = 1, y = 1, z = 1) {
  // 1️⃣ Load WGSL shader
  const shaderCode = await fetch(shaderPath).then((r) => r.text());
  const shaderModule = device.createShaderModule({ code: shaderCode });

  // 2️⃣ Create compute pipeline with auto layout
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module: shaderModule, entryPoint: "main" },
  });

  // 3️⃣ Create bind group entries
  const entries = Object.keys(bindings).map((name, i) => {
    const resource = bindings[name];
    if (resource instanceof GPUBuffer) {
      return { binding: i, resource: { buffer: resource } };
    } else if (resource instanceof GPUTexture) {
      return { binding: i, resource: resource.createView() };
    }
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: tsdfBuffer } },
      { binding: 1, resource: { buffer: depthMapBuffer } },
      { binding: 2, resource: { buffer: paramsBuffer } },
    ],
  });
  

  // 4️⃣ Dispatch compute
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(x, y, z);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
}

// utils/webgpu-utils.js
export function createVertexBuffer(device, data) {
  if (!data || !data.byteLength) {
    throw new Error("createVertexBuffer: data or data.byteLength is undefined");
  }

  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });

  const mapping = new Float32Array(buffer.getMappedRange());
  mapping.set(data);
  buffer.unmap();

  return buffer;
}
