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
    @location(2) color: vec3<f32>,
};
struct Uniforms {
  view_box : vec4<f32>,
};
struct Edges {
    edges : array<u32>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<storage, read> nodes : Nodes;
@group(0) @binding(2) var<storage, read> morton_codes : array<u32>;

fn u32_to_color(value: u32) -> vec3<f32> {
    // First convert u32 to f32 in [0,1] range
    // We need to be careful about precision here
    // Break the u32 into two parts to maintain precision
    let upper = f32(value >> 16u);
    let lower = f32(value & 0xFFFFu);
    
    // Combine the parts with appropriate scaling
    let normalized = (upper * 65536.0 + lower) / 4294967295.0;
    
    // Define the color gradient
    // Here we'll use a simple RGB gradient: blue -> cyan -> green -> yellow -> red
    let positions = array<f32, 5>(0.0, 0.25, 0.5, 0.75, 1.0);
    let colors = array<vec3<f32>, 5>(
        vec3<f32>(0.0, 0.0, 1.0),  // Blue
        vec3<f32>(0.0, 1.0, 1.0),  // Cyan
        vec3<f32>(0.0, 1.0, 0.0),  // Green
        vec3<f32>(1.0, 1.0, 0.0),  // Yellow
        vec3<f32>(1.0, 0.0, 0.0)   // Red
    );
    
    // Find the segment
    var i = 0;
    while i < 4 && normalized > positions[i + 1] {
        i = i + 1;
    }
    
    // Calculate interpolation factor
    let t = (normalized - positions[i]) / (positions[i + 1] - positions[i]);
    
    // Interpolate between colors
    let color = mix(colors[i], colors[i + 1], t);
    
    return color;
}

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
    let test = morton_codes[index];
    output.color = u32_to_color(test);
    return output;
}