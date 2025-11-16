export function initGPUBuffer(device, size, usage) {
  return device.createBuffer({
    size,
    usage:
      usage === "storage"
        ? GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        : GPUBufferUsage.UNIFORM,
  });
}

export function uploadDepthToGPU(device, depth) {
  const buffer = device.createBuffer({
    size: depth.data.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(buffer, 0, depth.data);
  return buffer;
}

// webgpu-utils.js
export async function computeShader(device, shaderUrl, bindings, x, y, z) {
  const shaderCode = await fetch(shaderUrl).then(r => r.text());
  const module = device.createShaderModule({ code: shaderCode });

  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "main" }
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: Object.entries(bindings).map(([name, buffer], i) => ({
      binding: i,
      resource: { buffer }
    }))
  });

  const commandEncoder = device.createCommandEncoder();
  const pass = commandEncoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(x, y, z);
  pass.end();
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
