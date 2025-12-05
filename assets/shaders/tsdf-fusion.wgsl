struct TSDFVoxel {
  value: f32,
  weight: f32,
};

@group(0) @binding(0) var<storage, read_write> tsdfGrid: array<TSDFVoxel>;
@group(0) @binding(1) var<storage, read> depthMap: array<f32>;
@group(0) @binding(2) var<uniform> params: vec4<f32>; // voxelSize, gridSize, truncation, unused
@group(0) @binding(3) var<uniform> widthHeight: vec2<f32>; // width, height

fn voxelToWorld(voxel: vec3<u32>) -> vec3<f32> {
  return vec3<f32>(f32(voxel.x), f32(voxel.y), f32(voxel.z)) * params.x;
}

@compute @workgroup_size(8, 8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let gridSize: u32 = u32(params.y);
  if (gid.x >= gridSize || gid.y >= gridSize || gid.z >= gridSize) { return; }

  let voxelIndex: u32 = gid.z * gridSize * gridSize + gid.y * gridSize + gid.x;
  let worldPos = voxelToWorld(vec3<u32>(gid.x, gid.y, gid.z));

  // Map to pixel
  let px = i32(worldPos.x / params.x); // simple scaling for demo
  let py = i32(worldPos.y / params.x);

  if (px < 0 || px >= i32(widthHeight.x) || py < 0 || py >= i32(widthHeight.y)) { return; }

  let depth = depthMap[py * i32(widthHeight.x) + px];
  if (depth <= 0.0) { return; }

  let sdf = depth - worldPos.z;
  let tsdfVal = clamp(sdf / params.z, -1.0, 1.0);

  var voxel = tsdfGrid[voxelIndex];
  let wOld = voxel.weight;
  let wNew: f32 = 1.0;
  voxel.value = (voxel.value * wOld + tsdfVal * wNew) / (wOld + wNew);
  voxel.weight = wOld + wNew;

  tsdfGrid[voxelIndex] = voxel;
}
