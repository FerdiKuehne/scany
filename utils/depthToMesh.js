// utils/depthToMesh.js
// Erzeugt ein 2.5D-Mesh (Heightfield) aus der Depthmap.
// Über "step" kannst du die Auflösung grober/feiner machen.
//
// WICHTIG ZUM TUNEN:
//   - step = 1 → volle Auflösung (sehr dichtes Mesh)
//   - step = 2 → halb so viele Vertices pro Achse
//   - step = 4 → noch groberes Drahtgitter
const DEFAULT_MESH_STEP = 4;

export function depthToMesh(
  depthArray,
  width,
  height,
  fx,
  fy,
  cx,
  cy,
  step = DEFAULT_MESH_STEP // <--- HIER GROB/FEIN EINSTELLEN
) {
  // sicherstellen, dass step >= 1
  step = Math.max(1, Math.floor(step));

  // grobes Raster berechnen
  const coarseWidth = Math.floor((width - 1) / step) + 1;
  const coarseHeight = Math.floor((height - 1) / step) + 1;

  const vertexCount = coarseWidth * coarseHeight;
  const vertices = new Float32Array(vertexCount * 3);

  // Depth → 3D-Position auf dem groben Raster
  for (let gy = 0; gy < coarseHeight; gy++) {
    for (let gx = 0; gx < coarseWidth; gx++) {
      // Sample-Koordinate im Original-Depthbild
      const u = gx * step;
      const v = gy * step;

      const srcIndex = v * width + u;
      const d = depthArray[srcIndex];

      const dstIndex = gy * coarseWidth + gx;
      const base = dstIndex * 3;

      if (!Number.isFinite(d) || d <= 0) {
        vertices[base + 0] = 0;
        vertices[base + 1] = 0;
        vertices[base + 2] = 0;
        continue;
      }

      const x = ((u - cx) * d) / fx;
      const y = ((v - cy) * d) / fy;
      const z = d;

      vertices[base + 0] = x;
      vertices[base + 1] = y;
      vertices[base + 2] = z;
    }
  }

  // Index-Buffer für Dreiecke im groben Raster
  const quadCountX = coarseWidth - 1;
  const quadCountY = coarseHeight - 1;
  const indexCount = quadCountX * quadCountY * 6;
  const indices = new Uint32Array(indexCount);

  let i = 0;
  for (let y = 0; y < quadCountY; y++) {
    for (let x = 0; x < quadCountX; x++) {
      const v0 = y * coarseWidth + x;
      const v1 = v0 + 1;
      const v2 = v0 + coarseWidth;
      const v3 = v2 + 1;

      // erstes Dreieck
      indices[i++] = v0;
      indices[i++] = v2;
      indices[i++] = v1;

      // zweites Dreieck
      indices[i++] = v1;
      indices[i++] = v2;
      indices[i++] = v3;
    }
  }

  return { vertices, indices };
}
