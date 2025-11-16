struct Vertex {
    pos: vec3<f32>,
    color: vec3<f32>,
};

@group(0) @binding(0) var<storage, read> tsdfGrid: array<f32>;
@group(0) @binding(1) var<uniform> viewProj: mat4x4<f32>;
@group(0) @binding(2) var<storage, write> vertexBuffer: array<Vertex>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let index: u32 = gid.x;
    if (index >= arrayLength(&tsdfGrid)) {
        return;
    }

    let value: f32 = tsdfGrid[index];
    if (value < 0.999) { // threshold for empty voxels
        return;
    }

    let x: u32 = index % 64;
    let y: u32 = (index / 64) % 64;
    let z: u32 = index / (64*64);

    var vertex: Vertex;
    vertex.pos = vec3<f32>(f32(x), f32(y), f32(z));
    vertex.color = vec3<f32>(value, value, value);

    vertexBuffer[index] = vertex;
}
