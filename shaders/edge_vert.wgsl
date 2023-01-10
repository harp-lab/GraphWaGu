//this builtin(position) clip_position tells that clip_position is the value we want to use for our vertex position or clip position
//it's not needed to create a struct, we could just do [[builtin(position)]] clipPosition
struct VertexOutput{
    @builtin(position) clip_position: vec4<f32>,
};
struct Uniforms {
  view_box : vec4<f32>,
};
struct Node {
    value : f32,
    x : f32,
    y : f32,
    size : f32,
};
struct Nodes {
    nodes : array<Node>,
};
struct Edges {
    edges : array<u32>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<storage, read> nodes : Nodes;
@group(0) @binding(2) var<storage, read> edges : Edges;
@vertex
fn main(@builtin(instance_index) index : u32, @location(0) position: vec2<f32>)-> VertexOutput {
    var out : VertexOutput;
    var node : Node = nodes.nodes[edges.edges[2u * index + u32(position.x)]];
    var inv_zoom : f32 = uniforms.view_box.z - uniforms.view_box.x;
    var expected_x : f32 = 0.5 * (1.0 - inv_zoom); 
    var expected_y : f32 = 0.5 * (1.0 - inv_zoom);
    // view_box expected to be between 0 and 1, panning need to be doubled as clip space is (-1, 1)
    var x : f32 = ((2.0 * node.x - 1.0) - 2.0 * (uniforms.view_box.x - expected_x)) / inv_zoom;
    var y : f32 = ((2.0 * node.y - 1.0) - 2.0 * (uniforms.view_box.y - expected_y)) / inv_zoom;
    out.clip_position = vec4<f32>(x, y, 0.0, 1.0);
    return out;
}