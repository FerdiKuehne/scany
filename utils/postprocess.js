// postprocess.js
// Normalize raw depth output to [0,1] for display
export function postprocess(depthArray) {
    let min = Infinity;
    let max = -Infinity;
  
    for (let i = 0; i < depthArray.length; i++) {
      if (depthArray[i] < min) min = depthArray[i];
      if (depthArray[i] > max) max = depthArray[i];
    }
  
    const normalized = new Float32Array(depthArray.length);
    const range = max - min || 1.0;
  
    for (let i = 0; i < depthArray.length; i++) {
      normalized[i] = (depthArray[i] - min) / range;
    }
  
    return normalized;
  }
  