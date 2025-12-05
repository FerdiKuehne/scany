import * as ort from "onnxruntime-web";

let session = null;
let initPromise = null;

// ✅ Set WASM paths before any session creation
ort.env.wasm.wasmPaths = "/ort/"; // folder in public containing .wasm files
ort.env.webgpu.powerPreference = "high-performance";

// Singleton chain to serialize inference calls in web environments
let webInferenceChain = Promise.resolve();

// Optional: log environment info
console.log("ONNX env:", ort.env);
console.log("WASM available:", !!ort.env.wasm);
console.log("WebGPU available:", !!ort.env.webgpu && navigator?.gpu !== undefined);

/**
 * Initialize the ONNX session
 * Safe to call multiple times — uses a singleton promise
 */
export async function initDepthEngine(modelPath = "/models/depth-anything-v2-small/model_q4f16.onnx") {
  if (session) return session;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log("[DepthEngine] Initializing ONNX session...");

      // Try WebGPU first
      if (navigator.gpu) {
        try {
          session = await ort.InferenceSession.create(modelPath, { executionProviders: ["webgpu"] });
          console.log("[DepthEngine] Loaded ONNX model via WebGPU");
          console.log("Model input names:", session.inputNames);
          return session;
        } catch (err) {
          console.warn("[DepthEngine] WebGPU failed, falling back to WASM:", err);
        }
      }

      // Fallback to WASM
      session = await ort.InferenceSession.create(modelPath, { executionProviders: ["wasm"] });
      console.log("[DepthEngine] Loaded ONNX model via WASM");
      console.log("Model input names:", session.inputNames);

      return session;
    } catch (e) {
      console.error("[DepthEngine] Failed to initialize:", e);
      throw e;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Run inference on an ImageData frame
 * @param {ImageData} frameImageData
 */
export async function runDepthEngine(frameImageData) {
  if (!session) throw new Error("Depth engine not initialized");

  const { width, height, data } = frameImageData;
  const inputTensorData = new Float32Array(3 * width * height);

  // Channels-first (R, G, B planes)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      inputTensorData[i] = data[i * 4 + 0] / 255;           // R
      inputTensorData[i + width * height] = data[i * 4 + 1] / 255 ; // G
      inputTensorData[i + 3 * width * height] = data[i * 4 + 2] / 255 ; // B
    }
  }

  const inputTensor = new ort.Tensor("float32", inputTensorData, [1, 3, height, width]);
  const feeds = { pixel_values: inputTensor };

  const outputMap = await (typeof window !== "undefined"
    ? (webInferenceChain = webInferenceChain.then(() => session.run(feeds)))
    : session.run(feeds));

  const firstOutputName = session.outputNames[0];
  const outputTensor = outputMap[firstOutputName];

  let outHeight, outWidth;

  if (outputTensor.dims.length === 3) {
    // [1, H, W]
    outHeight = outputTensor.dims[1];
    outWidth = outputTensor.dims[2];
  } else if (outputTensor.dims.length === 4) {
    // [1, 1, H, W] or [1, H, W, 1]
    if (outputTensor.dims[1] === 1) {
      outHeight = outputTensor.dims[2];
      outWidth = outputTensor.dims[3];
    } else if (outputTensor.dims[3] === 1) {
      outHeight = outputTensor.dims[1];
      outWidth = outputTensor.dims[2];
    } else {
      outHeight = outputTensor.dims[1];
      outWidth = outputTensor.dims[2];
      console.warn("Unknown tensor layout, guessing HxW:", outputTensor.dims);
    }
  } else {
    throw new Error("Unexpected output tensor shape: " + outputTensor.dims);
  }

  return {
    data: outputTensor.data,
    width: outWidth,
    height: outHeight,
  };
}



