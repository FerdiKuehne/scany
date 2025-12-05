export function initGPUBuffer(device, sizeOrData, type = "storage") {
  if (sizeOrData instanceof Float32Array || sizeOrData instanceof Uint32Array) {
    const buffer = device.createBuffer({
      size: sizeOrData.byteLength,
      usage: type === "storage"
        ? GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        : GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const array =
      sizeOrData instanceof Float32Array
        ? new Float32Array(buffer.getMappedRange())
        : new Uint32Array(buffer.getMappedRange());
    array.set(sizeOrData);
    buffer.unmap();
    return buffer;
  } else {
    return device.createBuffer({
      size: sizeOrData,
      usage: type === "storage"
        ? GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        : GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }
}




export function uploadDepthToGPU(device, depth) {
  const buffer = device.createBuffer({
    size: depth.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, depth);
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

  // Use bindings directly — no Object.entries mapping
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: bindings
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
