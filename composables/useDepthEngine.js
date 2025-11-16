import { pipeline } from "@huggingface/transformers";

let depthEstimator = null;

export function useDepthEngine() {
  async function init() {
    if (!depthEstimator) {
      depthEstimator = await pipeline(
        "depth-estimation",
        "onnx-community/depth-anything-v2-small"
      );
      console.log("[DepthEngine] Loaded SMALL model");
    }
  }

  async function run(frameImageData) {
    if (!depthEstimator) throw new Error("Depth engine not initialized");

    // Convert ImageData → data URL
    const canvas = document.createElement("canvas");
    canvas.width = frameImageData.width;
    canvas.height = frameImageData.height;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(frameImageData, 0, 0);

    const url = canvas.toDataURL();

    // RESULT FORMAT:
    // { depth: { data: Float32Array, width, height } }
    const { depth } = await depthEstimator(url);

    return depth;
  }

  return { init, run };
}
