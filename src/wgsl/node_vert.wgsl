struct Node {
    value : f32,
    x : f32,
    y : f32,
    size : f32,
};
struct Nodes {
    nodes : array<Node>,
};
struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) position: vec2<f32>,
    @location(1) @interpolate(flat) center : vec2<f32>,
};
struct Uniforms {
  view_box : vec4<f32>,
};
struct Edges {
    edges : array<u32>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<storage, read> nodes : Nodes;

@vertex
fn main(@builtin(instance_index) index : u32, @location(0) position : vec2<f32>)
     -> VertexOutput {
    var node_center : vec2<f32> = 2.0 * vec2<f32>(nodes.nodes[index].x, nodes.nodes[index].y) - vec2<f32>(1.0);
    var translation : vec2<f32> = position * 0.01;
    var out_position : vec2<f32> = node_center + translation;
    var output : VertexOutput;
    var inv_zoom : f32 = uniforms.view_box.z - uniforms.view_box.x;
    var expected_x : f32 = 0.5 * (1.0 - inv_zoom); 
    var expected_y : f32 = 0.5 * (1.0 - inv_zoom);
    // view_box expected to be between 0 and 1, panning need to be doubled as clip space is (-1, 1)
    var x : f32 = (out_position.x - 2.0 * (uniforms.view_box.x - expected_x)) / inv_zoom;
    var y : f32 = (out_position.y - 2.0 * (uniforms.view_box.y - expected_y)) / inv_zoom;
    output.Position = vec4<f32>(x, y, 0.0, 1.0);
    output.position = out_position;
    // flat interpolated position will give bottom right corner, so translate to center
    output.center = node_center;
    return output;
}