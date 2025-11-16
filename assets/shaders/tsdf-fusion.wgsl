struct TSDF {
    value: f32,
    weight: f32,
};

@group(0) @binding(0) var<storage, read_write> tsdfGrid: array<TSDF>;
@group(0) @binding(1) var<storage, read> depthMap: array<f32>;
@group(0) @binding(2) var<uniform> params: vec4<f32>; // voxel size, grid dims, truncation

@compute @workgroup_size(8,8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let gridSize: u32 = u32(params.y); // example
    let voxelIndex: u32 = gid.z * gridSize * gridSize + gid.y * gridSize + gid.x;

    // Get current voxel and depth
    var voxel: TSDF = tsdfGrid[voxelIndex];
    let depth: f32 = depthMap[voxelIndex % arrayLength(&depthMap)]; // map voxel to depth

    // Simple TSDF update
    let sdf: f32 = depth - length(vec3<f32>(f32(gid.x), f32(gid.y), f32(gid.z)) * params.x);
    let trunc: f32 = params.z;
    let tsdfVal: f32 = clamp(sdf / trunc, -1.0, 1.0);

    // Weighted average
    let wOld: f32 = voxel.weight;
    let wNew: f32 = 1.0;
    voxel.value = (voxel.value * wOld + tsdfVal * wNew) / (wOld + wNew);
    voxel.weight = wOld + wNew;

    tsdfGrid[voxelIndex] = voxel;
}
