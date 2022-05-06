// compute terrain wgsl
struct Node {
    value : f32,
    x : f32,
    y : f32,
    size : f32,
};
struct Nodes {
    nodes : array<Node>,
};
struct Uniforms {
  image_width : u32,
  image_height : u32,
  nodes_length : u32,
  width_factor : f32,
  view_box : vec4<f32>,
};
struct Pixels {
    pixels : array<f32>,
};
struct Range {
    x : atomic<i32>,
    y : atomic<i32>,
};

@group(0) @binding(0) var<storage, read_write> nodes : Nodes;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;
@group(0) @binding(2) var<storage, write> pixels : Pixels;
@group(0) @binding(3) var<storage, read_write> range : Range;

@stage(compute) @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    var pixel_index : u32 = global_id.x + global_id.y * uniforms.image_width;
    var x : f32 = f32(global_id.x) / f32(uniforms.image_width);
    var y : f32 = f32(global_id.y) / f32(uniforms.image_height);
    x = x * (uniforms.view_box.z - uniforms.view_box.x) + uniforms.view_box.x;
    y = y * (uniforms.view_box.w - uniforms.view_box.y) + uniforms.view_box.y;
    var value : f32 = 0.0;

    for (var i : u32 = 0u; i < uniforms.nodes_length; i = i + 1u) {
        var sqrDistance : f32 = (x - nodes.nodes[i].x) * (x - nodes.nodes[i].x) + (y - nodes.nodes[i].y) * (y - nodes.nodes[i].y);
        value = value + nodes.nodes[i].value / (sqrDistance * uniforms.width_factor + 1.0);
    }
    value = value * 100.0;
    atomicMin(&range.x, i32(floor(value)));
    atomicMax(&range.y, i32(ceil(value)));
    pixels.pixels[pixel_index] = value;
}