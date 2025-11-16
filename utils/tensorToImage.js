// tensorToImage.js
export function tensorToImage(depthArray, width, height, canvas) {
    const ctx = canvas.getContext("2d");
    const imgData = ctx.createImageData(width, height);
  
    for (let i = 0; i < width * height; i++) {
      const d = Math.floor(depthArray[i] * 255);
      imgData.data[i * 4 + 0] = d;
      imgData.data[i * 4 + 1] = d;
      imgData.data[i * 4 + 2] = d;
      imgData.data[i * 4 + 3] = 255;
    }
  
    ctx.putImageData(imgData, 0, 0);
  }
  