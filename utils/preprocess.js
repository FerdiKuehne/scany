// preprocess.js
// Converts ImageData (from webcam) into Float32Array for ONNX model input
export function preprocess(imageData, width = 256, height = 256) {
    const { data } = imageData; // RGBA
    const tensor = new Float32Array(3 * width * height);
    let idx = 0;
  
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        // Normalize to [0,1] and rearrange to CHW
        tensor[idx] = data[i] / 255.0;       // R
        tensor[idx + width * height] = data[i + 1] / 255.0; // G
        tensor[idx + 2 * width * height] = data[i + 2] / 255.0; // B
        idx++;
      }
    }
    return tensor;
  }
  