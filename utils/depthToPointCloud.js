// src/utils/depthToPointCloud.js

/**
 * Konvertiert eine Depthmap in eine Punktwolke im Kamerakoordinatensystem.
 *
 * @param {Float32Array} depthArray - depth values in Metern, Länge = width * height
 * @param {number} width  - Breite der Depthmap
 * @param {number} height - Höhe der Depthmap
 * @param {number} fx - focal length in Pixeln (x)
 * @param {number} fy - focal length in Pixeln (y)
 * @param {number} cx - principal point x (meist width / 2)
 * @param {number} cy - principal point y (meist height / 2)
 * @returns {Float32Array} - [x0, y0, z0, x1, y1, z1, ...]
 */
export function depthToPointCloud(
  depthArray,
  width,
  height,
  fx,
  fy,
  cx,
  cy
) {
  const numPixels = width * height;
  const points = new Float32Array(numPixels * 3);

  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      const idx = v * width + u;
      const z = depthArray[idx];

      if (!z || z <= 0) continue; // ungültige Tiefen überspringen

      const x = (u - cx) / fx * z;
      const y = (v - cy) / fy * z;

      const p = idx * 3;
      points[p + 0] = x;
      points[p + 1] = y;
      points[p + 2] = z;
    }
  }

  return points;
}
