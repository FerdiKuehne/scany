@group(0) @binding(0) var<storage, read> depthIn: array<f32>;
@group(0) @binding(1) var<storage, write> depthOut: array<f32>;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let width: u32 = 256;  // or match input size
    let height: u32 = 256;

    if (gid.x >= width || gid.y >= height) {
        return;
    }

    let index: u32 = gid.y * width + gid.x;
    let d: f32 = depthIn[index];

    // Simple min-max normalization
    let minD: f32 = 0.0;
    let maxD: f32 = 10.0;
    let norm: f32 = clamp((d - minD) / (maxD - minD), 0.0, 1.0);

    depthOut[index] = norm;
}
