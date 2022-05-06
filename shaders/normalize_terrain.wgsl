// normalize terrain wgsl
struct Uniforms {
  image_width : u32,
  image_height : u32,
  nodes_length : u32,
  width_factor : f32,
};
struct Pixels {
    pixels : array<f32>,
};
struct Range {
    x : i32,
    y : i32,
};

@group(0) @binding(0) var<storage, write> pixels : Pixels;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;
@group(0) @binding(2) var<storage, read_write> range : Range;

@stage(compute) @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    var pixel_index : u32 = global_id.x + global_id.y * uniforms.image_width;
    pixels.pixels[pixel_index] = (pixels.pixels[pixel_index] - f32(range.x)) / f32(range.y - range.x);
}