export const  compute_terrain = `// compute terrain wgsl
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
}`;
export const  normalize_terrain = `// normalize terrain wgsl
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
}`;
export const  display_2d_vert = `// Vertex shader
struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) fragPosition: vec4<f32>,
};

@stage(vertex)
fn main(@location(0) position : vec4<f32>)
     -> VertexOutput {
    var output : VertexOutput;
    output.Position = position;
    output.fragPosition = 0.5 * (position + vec4<f32>(1.0, 1.0, 1.0, 1.0));
    return output;
}


`;
export const  display_2d_frag = `// Fragment shader
struct Pixels {
    pixels : array<f32>,
};
struct Uniforms {
    peak_value : f32,
    valley_value : f32,
};
struct Image {
    width : u32,
    height : u32,
};

@group(0) @binding(0) var myTexture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read> pixels : Pixels;
@group(0) @binding(2) var<uniform> uniforms : Uniforms;
@group(0) @binding(3) var<uniform> image_size : Image;

fn outside_grid(p : vec2<u32>) -> bool {
    return any(p == vec2<u32>(u32(0))) || p.x == image_size.width || p.y == image_size.height;
}

@stage(fragment)
fn main(@location(0) fragPosition: vec4<f32>) -> @location(0) vec4<f32> {
    var ufragPos : vec4<u32> = vec4<u32>(fragPosition * f32(image_size.width));
    var pixelIndex : u32 = ufragPos.x + ufragPos.y * image_size.width;
    var value : f32 = pixels.pixels[pixelIndex];
    if (!outside_grid(ufragPos.xy)){
        var neighbor_peaks : vec4<bool> = vec4<bool>(
            pixels.pixels[pixelIndex - image_size.width] >= uniforms.peak_value ,
            pixels.pixels[pixelIndex - u32(1)] >= uniforms.peak_value,
            pixels.pixels[pixelIndex + u32(1)] >= uniforms.peak_value,
            pixels.pixels[pixelIndex + image_size.width] >= uniforms.peak_value
        );
        var neighbor_valleys : vec4<bool> = vec4<bool>(
            pixels.pixels[pixelIndex - image_size.width] <= uniforms.valley_value,
            pixels.pixels[pixelIndex - u32(1)] <= uniforms.valley_value,
            pixels.pixels[pixelIndex + u32(1)] <= uniforms.valley_value,
            pixels.pixels[pixelIndex + image_size.width] <= uniforms.valley_value
        ); 
        if (any(neighbor_peaks) && value < uniforms.peak_value) {
            return vec4<f32>(0.8, 0.5, 0.5, 1.0);
        }
        if (any(neighbor_valleys) && value > uniforms.valley_value) {
            return vec4<f32>(0.5, 0.3, 0.3, 1.0);
        }
    }
    var color : vec4<f32> = textureLoad(myTexture, vec2<i32>(i32(value * 180.0), 1), 0);
    return color;
}`;
export const  display_3d_vert = `// Vertex shader
struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) vray_dir: vec3<f32>,
  @location(1) @interpolate(flat) transformed_eye: vec3<f32>,
};
struct Uniforms {
  proj_view : mat4x4<f32>,
  eye_pos : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : Uniforms;

[[stage(vertex)]]
fn main(@location(0) position : vec3<f32>)
     -> VertexOutput {
    var output : VertexOutput;
    var volume_translation : vec3<f32> = vec3<f32>(-0.5, -0.5, -0.5);
    output.Position = uniforms.proj_view * vec4<f32>(position + volume_translation, 1.0);
    output.transformed_eye = uniforms.eye_pos.xyz - volume_translation;
    output.vray_dir = position - output.transformed_eye;
    return output;
}`;
export const  display_3d_frag = `// Fragment shader
struct Pixels {
    pixels : array<f32>,
};
struct Image {
    width : u32,
    height : u32,
};

@group(0) @binding(1) var colormap: texture_2d<f32>;
@group(0) @binding(2) var<storage, read> pixels : Pixels;
@group(0) @binding(3) var<uniform> image_size : Image;

fn intersect_box(orig : vec3<f32>, dir : vec3<f32>, box_min : vec3<f32>, box_max : vec3<f32>) -> vec2<f32> {
    let inv_dir : vec3<f32> = 1.0 / dir;
    let tmin_tmp : vec3<f32> = (box_min - orig) * inv_dir;
    let tmax_tmp : vec3<f32> = (box_max - orig) * inv_dir;
    var tmin : vec3<f32> = min(tmin_tmp, tmax_tmp);
    var tmax : vec3<f32> = max(tmin_tmp, tmax_tmp);
    var t0 : f32 = max(tmin.x, max(tmin.y, tmin.z));
    var t1 : f32 = min(tmax.x, min(tmax.y, tmax.z));
    return vec2<f32>(t0, t1);
}

fn outside_grid(p : vec3<f32>, volumeDims : vec3<f32>) -> bool {
    return any(p < vec3<f32>(0.0)) || any(p >= volumeDims);
}

@stage(fragment)
fn main(
  @location(0) vray_dir: vec3<f32>, 
  @location(1) @interpolate(flat) transformed_eye : vec3<f32>
)-> @location(0) vec4<f32> {
    var ray_dir : vec3<f32> = normalize(vray_dir);
    var longest_axis : f32 = f32(max(image_size.width, image_size.height));
    let volume_dims : vec3<f32> = vec3<f32>(f32(image_size.width), f32(image_size.height), f32(longest_axis));
    let vol_eye : vec3<f32> = transformed_eye * volume_dims;
    let grid_ray_dir : vec3<f32> = normalize(ray_dir * volume_dims);

    var t_hit : vec2<f32> = intersect_box(vol_eye, grid_ray_dir, vec3<f32>(0.0), volume_dims - 1.0);
    if (t_hit.x > t_hit.y) { 
        discard;
    }

    t_hit.x = max(t_hit.x, 0.0);

    var p : vec3<f32> = (vol_eye + t_hit.x * grid_ray_dir);
    p = clamp(p, vec3<f32>(0.0), volume_dims - 2.0);
    let inv_grid_ray_dir : vec3<f32> = 1.0 / grid_ray_dir;
    let start_cell : vec3<f32> = floor(p);
    let t_max_neg : vec3<f32> = (start_cell - vol_eye) * inv_grid_ray_dir;
    let t_max_pos : vec3<f32> = (start_cell + 1.0 - vol_eye) * inv_grid_ray_dir;
    let is_neg_dir : vec3<f32> = vec3<f32>(grid_ray_dir < vec3<f32>(0.0));
    // Pick between positive/negative t_max based on the ray sign
    var t_max : vec3<f32> = mix(t_max_pos, t_max_neg, is_neg_dir);
    let grid_step : vec3<i32> = vec3<i32>(sign(grid_ray_dir));
    // Note: each voxel is a 1^3 box on the grid
    let t_delta : vec3<f32> = abs(inv_grid_ray_dir);

    var t_prev : f32 = t_hit.x;
    // Traverse the grid
    loop {
        if (outside_grid(p, volume_dims)) { break; }
        let v000 : vec3<u32> = vec3<u32>(p);
        var pixel_index : u32 = v000.x + v000.y * image_size.width;
        var value : f32 = pixels.pixels[pixel_index];
        if (f32(v000.z) > longest_axis / 2.0) {
            if (value * longest_axis >= f32(v000.z)) {
                return textureLoad(colormap, vec2<i32>(i32(value * 180.0), 1), 0);
            }
        } elseif (f32(v000.z) < longest_axis / 2.0) {
            if (value * longest_axis <= f32(v000.z)) {
                return textureLoad(colormap, vec2<i32>(i32(value * 180.0), 1), 0);
            }
        } else {
            return textureLoad(colormap, vec2<i32>(i32(value * 180.0), 1), 0);
        }

        let t_next : f32 = min(t_max.x, min(t_max.y, t_max.z));
        t_prev = t_next;
        if (t_next == t_max.x) {
            p.x = p.x + f32(grid_step.x);
            t_max.x = t_max.x + t_delta.x;
        } elseif (t_next == t_max.y) {
            p.y = p.y + f32(grid_step.y);
            t_max.y = t_max.y + t_delta.y;
        } else {
            p.z = p.z + f32(grid_step.z);
            t_max.z = t_max.z + t_delta.z;
        }
    }
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
}

`;
export const  node_vert = `struct Node {
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

@stage(vertex)
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
}`;
export const  node_frag = `fn sigmoid(x: f32) -> f32 {
    return 1.0 / (1.0 + exp(-1.0 * x));
}

@stage(fragment)
fn main(@location(0) position: vec2<f32>, @location(1) @interpolate(flat) center: vec2<f32>) -> @location(0) vec4<f32> {
    if (distance(position, center) > 0.002) {
        discard;
    }
    return vec4<f32>(0.0, 0.0, 0.0, 1.0 - distance(position, center) * 500.0);
}
`;
export const  edge_vert = `//this builtin(position) clip_position tells that clip_position is the value we want to use for our vertex position or clip position
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
@stage(vertex)
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
}`;
export const  edge_frag = `@stage(fragment)
fn main()->@location(0) vec4<f32>{
    return vec4<f32>(0.0, 0.0, 0.0, 0.1);
}`;
export const  compute_forces = `struct Node {
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
struct Forces {
    forces : array<f32>,
};
struct Uniforms {
    nodes_length : u32,
    edges_length : u32,
    cooling_factor : f32,
    ideal_length : f32,
};

@group(0) @binding(0) var<storage, read> nodes : Nodes;
@group(0) @binding(1) var<storage, read> adjmat : Edges;
@group(0) @binding(2) var<storage, write> forces : Forces;
@group(0) @binding(3) var<uniform> uniforms : Uniforms;

fn get_bit_selector(bit_index : u32) -> u32 {
    return 1u << bit_index;
}

fn get_nth_bit(packed : u32, bit_index : u32) -> u32 {
    return packed & get_bit_selector(bit_index);
}

@stage(compute) @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let l : f32 = uniforms.ideal_length;
    let node : Node = nodes.nodes[global_id.x];
    var r_force : vec2<f32> = vec2<f32>(0.0, 0.0);
    var a_force : vec2<f32> = vec2<f32>(0.0, 0.0);
    for (var i : u32 = 0u; i < uniforms.nodes_length; i = i + 1u) {
        if (i == global_id.x) {
            continue;
        }
        var node2 : Node = nodes.nodes[i];
        var dist : f32 = distance(vec2<f32>(node.x, node.y), vec2<f32>(node2.x, node2.y));
        if (dist > 0.0){
            if (get_nth_bit(adjmat.edges[(i * uniforms.nodes_length + global_id.x) / 32u], (i * uniforms.nodes_length + global_id.x) % 32u) != 0u) {
                var dir : vec2<f32> = normalize(vec2<f32>(node2.x, node2.y) - vec2<f32>(node.x, node.y));
                a_force = a_force + ((dist * dist) / l) * dir;
            } else {
                var dir : vec2<f32> = normalize(vec2<f32>(node.x, node.y) - vec2<f32>(node2.x, node2.y));
                r_force = r_force + ((l * l) / dist) * dir;
            }
        }
    }
    var force : vec2<f32> = (a_force + r_force);
    var localForceMag: f32 = length(force); 
    if (localForceMag>0.000000001) {
        force = normalize(force) * min(uniforms.cooling_factor, length(force));
    }
    else{
        force.x = 0.0;
        force.y = 0.0;
    }
    forces.forces[global_id.x * 2u] = force.x;
    forces.forces[global_id.x * 2u + 1u] = force.y;
}
`;
export const  compute_forcesBH = `struct Node {
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
struct Stack {
    a : array<u32>,
}
struct Forces {
    forces : array<f32>,
};
struct Uniforms {
    nodes_length : u32,
    edges_length : u32,
    cooling_factor : f32,
    ideal_length : f32,
};
struct Rectangle {
    x : f32,
    y : f32,
    w : f32,
    h : f32,
};
struct QuadTree {
    boundary : Rectangle,
    NW : f32,
    NE : f32,
    SW : f32,
    SE : f32,
    CoM : vec2<f32>,
    mass : f32,
    test : f32,
};
struct QuadTrees {
    quads : array<QuadTree>,
}
struct Batch {
    batch_id : u32,
}

@group(0) @binding(0) var<storage, read> nodes : Nodes;
@group(0) @binding(1) var<storage, write> forces : Forces;
@group(0) @binding(2) var<uniform> uniforms : Uniforms;
@group(0) @binding(3) var<storage, read> quads : QuadTrees;
@group(0) @binding(4) var<storage, write> stack : Stack;
@group(0) @binding(5) var<uniform> batch : Batch;

@stage(compute) @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let l : f32 = uniforms.ideal_length;
    var batch_index : u32 = global_id.x + batch.batch_id * (uniforms.nodes_length / 1u);
    // for (var iter = 0u; iter < 10u; iter = iter + 1u) {
    let node : Node = nodes.nodes[batch_index];
    var theta : f32 = 0.8;
    var r_force : vec2<f32> = vec2<f32>(0.0, 0.0);
    var a_force : vec2<f32> = vec2<f32>(forces.forces[batch_index * 2u], forces.forces[batch_index * 2u + 1u]);
    var index : u32 = 0u;
    var stack_index : u32 = batch_index * 1000u;
    var counter : u32 = batch_index * 1000u;
    var out : u32 = 0u;
    loop {
        out = out + 1u;
        if (out == 1000u) {
            break;
        }
        var quad : QuadTree = quads.quads[index];
        let dist : f32 = distance(vec2<f32>(node.x, node.y), quad.CoM);
        let s : f32 = 2.0 * quad.boundary.w;
        if (theta > s / dist) {
            var dir : vec2<f32> = normalize(vec2<f32>(node.x, node.y) - quad.CoM);
            r_force = r_force + quad.mass * ((l * l) / dist) * dir;
        } else {
            let children : array<u32, 4> = array<u32, 4>(
                u32(quads.quads[index].NW),
                u32(quads.quads[index].NE),
                u32(quads.quads[index].SW),
                u32(quads.quads[index].SE)
            );
            for (var i : u32 = 0u; i < 4u; i = i + 1u) {
                let child : u32 = children[i];
                quad = quads.quads[child];
                if (child == 0u || quad.mass < 1.0) {
                    continue;
                } else {
                    if (quad.mass > 1.0) {
                        stack.a[counter] = child;
                        counter = counter + 1u;
                    } else {
                        let dist : f32 = distance(vec2<f32>(node.x, node.y), quad.CoM);
                        if (dist > 0.0) {
                            var dir : vec2<f32> = normalize(vec2<f32>(node.x, node.y) - quad.CoM);
                            r_force = r_force + ((l * l) / dist) * dir;
                        }
                    }
                }
            }
        }
        index = stack.a[stack_index];
        if (index == 0u) {
            break;
        } 
        stack_index = stack_index + 1u;
    }
    var force : vec2<f32> = (a_force + r_force);
    var localForceMag: f32 = length(force); 
    if (localForceMag>0.000000001) {
        force = normalize(force) * min(uniforms.cooling_factor, length(force));
    }
    else{
        force.x = 0.0;
        force.y = 0.0;
    }
    if (force.x > uniforms.cooling_factor) {
        force.x = 0.0;
    }
    if (force.y > uniforms.cooling_factor) {
        force.y = 0.0;
    }
    forces.forces[batch_index * 2u] = force.x;
    forces.forces[batch_index * 2u + 1u] = force.y;
    //     batch_index = batch_index + 1u;
    // }
    // forces.forces[global_id.x * 2u] = 1.0;
    // forces.forces[global_id.x * 2u + 1u] = 1.0;
}
`;
export const  compute_attract_forces = `struct Node {
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
struct Forces {
    forces : array<f32>,
};
struct Uniforms {
    nodes_length : u32,
    edges_length : u32,
    cooling_factor : f32,
    ideal_length : f32,
};

@group(0) @binding(0) var<storage, read> nodes : Nodes;
@group(0) @binding(1) var<storage, read> edges : Edges;
@group(0) @binding(2) var<storage, read_write> forces : Forces;
@group(0) @binding(3) var<uniform> uniforms : Uniforms;

@stage(compute) @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    // let i : u32 = global_id.x;
    let l : f32 = uniforms.ideal_length;
    for (var i : u32 = 0u; i < uniforms.edges_length; i = i + 2u) {
        var a_force : vec2<f32> = vec2<f32>(0.0, 0.0);
        var node : Node = nodes.nodes[edges.edges[i]];
        var node2 : Node = nodes.nodes[edges.edges[i + 1u]];
        var dist : f32 = distance(vec2<f32>(node.x, node.y), vec2<f32>(node2.x, node2.y));
        if(dist > 0.0) {
            var dir : vec2<f32> = normalize(vec2<f32>(node2.x, node2.y) - vec2<f32>(node.x, node.y));
            a_force = ((dist * dist) / l) * dir;
            forces.forces[edges.edges[i] * 2u] = forces.forces[edges.edges[i] * 2u] + a_force.x;
            forces.forces[edges.edges[i] * 2u + 1u] = forces.forces[edges.edges[i] * 2u + 1u] + a_force.y;
            forces.forces[edges.edges[i + 1u] * 2u] = forces.forces[edges.edges[i + 1u] * 2u] - a_force.x;
            forces.forces[edges.edges[i + 1u] * 2u + 1u] = forces.forces[edges.edges[i + 1u] * 2u + 1u] - a_force.y;
        }
    }
}`;
export const  apply_forces = `struct Node {
    value : f32,
    x : f32,
    y : f32,
    size : f32,
};
struct Nodes {
    nodes : array<Node>,
};
struct Forces {
    forces : array<f32>,
};
struct Batch {
    batch_id : u32,
};
struct Uniforms {
    nodes_length : u32,
    edges_length : u32,
    cooling_factor : f32,
    ideal_length : f32,
};
struct Range {
    x_min : atomic<i32>,
    x_max : atomic<i32>,
    y_min : atomic<i32>,
    y_max : atomic<i32>
};
@group(0) @binding(0) var<storage, read_write> nodes : Nodes;
@group(0) @binding(1) var<storage, read_write> forces : Forces;
// @group(0) @binding(2) var<uniform> batch : Batch;
@group(0) @binding(2) var<uniform> uniforms : Uniforms;
@group(0) @binding(3) var<storage, read_write> bounding : Range;

@stage(compute) @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    var high : f32 = 8.0;
    var low : f32 = -7.0;
    var batch_index : u32 = global_id.x;
    for (var iter = 0u; iter < 2u; iter = iter + 1u) {
        // nodes.nodes[batch_index].x = nodes.nodes[batch_index].x + forces.forces[batch_index * 2u];
        // nodes.nodes[batch_index].y = nodes.nodes[batch_index].y + forces.forces[batch_index * 2u + 1u]; 
        if (forces.forces[batch_index * 2u] > uniforms.cooling_factor) {
            // atomicStore(&bounding.y_max, i32(batch_index));
            forces.forces[batch_index * 2u] = 0.0;    
        }
        if (forces.forces[batch_index * 2u + 1u] > uniforms.cooling_factor) {
            // atomicStore(&bounding.y_min, i32(batch_index));
            forces.forces[batch_index * 2u + 1u] = 0.0;    
        }
        var x : f32 = min(high, max(low, nodes.nodes[batch_index].x + forces.forces[batch_index * 2u]));
        var y : f32 = min(high, max(low, nodes.nodes[batch_index].y + forces.forces[batch_index * 2u + 1u]));

        // var centering : vec2<f32> = normalize(vec2<f32>(0.5, 0.5) - vec2<f32>(x, y));
        // var dist : f32 = distance(vec2<f32>(0.5, 0.5), vec2<f32>(x, y));
        // x = x + centering.x * (0.1 * uniforms.cooling_factor * dist);
        // y = y + centering.y * (0.1 * uniforms.cooling_factor * dist);
        // Randomize position slightly to prevent exact duplicates after clamping
        if (x == high) {
            x = x - f32(batch_index) / 500000.0; 
        } 
        if (y == high) {
            y = y - f32(batch_index) / 500000.0; 
        }
        if (x == low) {
            x = x + f32(batch_index) / 500000.0; 
        }
        if (y == low) {
            y = y + f32(batch_index) / 500000.0; 
        }
        nodes.nodes[batch_index].x = x;
        nodes.nodes[batch_index].y = y;
        forces.forces[batch_index * 2u] = 0.0;
        forces.forces[batch_index * 2u + 1u] = 0.0;
        atomicMin(&bounding.x_min, i32(floor(x * 1000.0)));
        atomicMax(&bounding.x_max, i32(floor(x * 1000.0)));
        atomicMin(&bounding.y_min, i32(floor(y * 1000.0)));
        atomicMax(&bounding.y_max, i32(floor(y * 1000.0)));


        // var test : f32 = forces.forces[0]; 
        // var test2 : f32 = nodes.nodes[0].x;
        batch_index = batch_index + (uniforms.nodes_length / 2u);
    }
}
`;
export const  create_adjacency_matrix = `struct Edges {
    edges : array<u32>,
};
struct BoolArray {
    matrix : array<u32>,
};
struct Uniforms {
    nodes_length : u32,
    edges_length : u32,
    cooling_factor : f32,
    ideal_length : f32,
};
struct IntArray {
    matrix : array<i32>,
};

@group(0) @binding(0) var<storage, read> edges : Edges;
@group(0) @binding(1) var<storage, read_write> adjmat : BoolArray;
@group(0) @binding(2) var<uniform> uniforms : Uniforms;
@group(0) @binding(3) var<storage, read_write> laplacian : IntArray;

fn get_bit_selector(bit_index : u32) -> u32 {
    return 1u << bit_index;
}

fn set_nth_bit(packed : u32, bit_index : u32) -> u32{
    return packed | get_bit_selector(bit_index);
}

@stage(compute) @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    for (var i : u32 = 0u; i < uniforms.edges_length; i = i + 2u) {
        var source : u32 = edges.edges[i];
        var target : u32 = edges.edges[i + 1u];
        adjmat.matrix[(source * uniforms.nodes_length + target) / 32u] = set_nth_bit(adjmat.matrix[(source * uniforms.nodes_length + target) / 32u], (source * uniforms.nodes_length + target) % 32u);
        adjmat.matrix[(target * uniforms.nodes_length + source) / 32u] = set_nth_bit(adjmat.matrix[(target * uniforms.nodes_length + source) / 32u], (target * uniforms.nodes_length + source) % 32u);
        // if (laplacian.matrix[source * uniforms.nodes_length + target] != -1 && source != target) {
        //     laplacian.matrix[source * uniforms.nodes_length + target] = -1;
        //     laplacian.matrix[target * uniforms.nodes_length + source] = -1;
        //     laplacian.matrix[source * uniforms.nodes_length + source] = laplacian.matrix[source * uniforms.nodes_length + source] + 1;
        //     laplacian.matrix[target * uniforms.nodes_length + target] = laplacian.matrix[target * uniforms.nodes_length + target] + 1;
        // }
    } 
}
`;
export const  create_quadtree = `struct Node {
    value : f32,
    x : f32,
    y : f32,
    size : f32,
};
struct Nodes {
    nodes : array<Node>,
};
struct Rectangle {
    x : f32,
    y : f32,
    w : f32,
    h : f32,
};
struct QuadTree {
    boundary : Rectangle,
    // In order NW, NE, SW, SE
    pointers : vec4<f32>,
    CoM : vec2<f32>,
    mass : f32,
    test : f32,
};
struct Uniforms {
    nodes_length : u32,
    edges_length : u32,
    cooling_factor : f32,
    ideal_length : f32,
};
struct QuadTrees {
    quads : array<QuadTree>,
}
struct Range {
    x_min : i32,
    x_max : i32,
    y_min : i32,
    y_max : i32
};

@group(0) @binding(0) var<storage, read> nodes : Nodes;
@group(0) @binding(1) var<storage, read_write> quads : QuadTrees;
@group(0) @binding(2) var<uniform> uniforms : Uniforms;
@group(0) @binding(3) var<storage, read_write> bounding : Range;

@stage(compute) @workgroup_size(1, 1, 1)
fn main() {
    let x_min : f32 = f32(bounding.x_min) / 1000.0;
    let y_min : f32 = f32(bounding.y_min) / 1000.0;
    let width : f32 = f32(bounding.x_max - bounding.x_min) / 1000.0;
    let height : f32 = f32(bounding.y_max - bounding.y_min) / 1000.0;
    quads.quads[0] = QuadTree(
        Rectangle(x_min, y_min, width, height),
        // Can use 0 as null pointer for indexing because 0 is always root
        vec4<f32>(0.0, 0.0, 0.0, 0.0),
        vec2<f32>(-1.0, -1.0),
        0.0, 0.0
    ); 
    var counter : u32 = 1u;
    for (var i : u32 = 0u; i < uniforms.nodes_length; i = i + 1u) {
        var index : u32 = 0u;
        loop {
            // We have null cell so create body
            if (quads.quads[index].mass < 1.0) {
                quads.quads[index].mass = 1.0;
                quads.quads[index].CoM = vec2<f32>(nodes.nodes[i].x, nodes.nodes[i].y);
                break;
            }
            // Found a cell or body
            let boundary : Rectangle = quads.quads[index].boundary;
            // Found body, need to partition
            if (quads.quads[index].mass < 2.0) {
                quads.quads[index].pointers.x = f32(counter);                                   
                quads.quads[counter] = QuadTree(
                    Rectangle(boundary.x, boundary.y + boundary.h / 2.0, boundary.w / 2.0, boundary.h / 2.0),
                    vec4<f32>(0.0, 0.0, 0.0, 0.0),
                    vec2<f32>(-1.0, -1.0),
                    0.0, 0.0
                );
                quads.quads[index].pointers.y = f32(counter + 1u);      
                quads.quads[counter + 1u] = QuadTree(
                    Rectangle(boundary.x + boundary.w / 2.0, boundary.y + boundary.h / 2.0, boundary.w / 2.0, boundary.h / 2.0),
                    vec4<f32>(0.0, 0.0, 0.0, 0.0),
                    vec2<f32>(-1.0, -1.0),
                    0.0, 0.0
                );
                quads.quads[index].pointers.z = f32(counter + 2u);                                   
                quads.quads[counter + 2u] = QuadTree(
                    Rectangle(boundary.x, boundary.y, boundary.w / 2.0, boundary.h / 2.0),
                    vec4<f32>(0.0, 0.0, 0.0, 0.0),
                    vec2<f32>(-1.0, -1.0),
                    0.0, 0.0
                );
                quads.quads[index].pointers.w = f32(counter + 3u);               
                quads.quads[counter + 3u] = QuadTree(
                    Rectangle(boundary.x + boundary.w / 2.0, boundary.y, boundary.w / 2.0, boundary.h / 2.0),
                    vec4<f32>(0.0, 0.0, 0.0, 0.0),
                    vec2<f32>(-1.0, -1.0),
                    0.0, 0.0
                );
                counter = counter + 4u;
                // if (any(quads.quads[index].CoM == vec2<f32>(nodes.nodes[i].x, nodes.nodes[i].y))) {
                //     quads.quads[index].CoM = quads.quads[index].CoM + vec2<f32>(0.001, 0.001);
                // }
                let x : f32 = quads.quads[index].CoM.x;
                let y : f32 = quads.quads[index].CoM.y;
                if (x <= boundary.x + boundary.w / 2.0) {
                    if (y <= boundary.y + boundary.h / 2.0) {
                        quads.quads[u32(quads.quads[index].pointers.z)].mass = 1.0;
                        quads.quads[u32(quads.quads[index].pointers.z)].CoM = vec2<f32>(x, y);
                    } else {
                        quads.quads[u32(quads.quads[index].pointers.x)].mass = 1.0;
                        quads.quads[u32(quads.quads[index].pointers.x)].CoM = vec2<f32>(x, y);     
                    }
                } else {
                    if (y <= boundary.y + boundary.h / 2.0) {
                        quads.quads[u32(quads.quads[index].pointers.w)].mass = 1.0;
                        quads.quads[u32(quads.quads[index].pointers.w)].CoM = vec2<f32>(x, y);
                    } else {
                        quads.quads[u32(quads.quads[index].pointers.y)].mass = 1.0;
                        quads.quads[u32(quads.quads[index].pointers.y)].CoM = vec2<f32>(x, y);     
                    }
                }  
            } 
            let node_x : f32 = nodes.nodes[i].x;
            let node_y : f32 = nodes.nodes[i].y;
            // We are inserting in this cell so change mass and CoM
            let mass : f32 = quads.quads[index].mass;
            quads.quads[index].CoM = (mass * quads.quads[index].CoM + vec2<f32>(node_x, node_y)) / (mass + 1.0);
            quads.quads[index].mass = mass + 1.0;
            // Find where to recurse to
            if (node_x <= boundary.x + boundary.w / 2.0) {
                if (node_y <= boundary.y + boundary.h / 2.0) {
                    index = u32(quads.quads[index].pointers.z);
                } else {
                    index = u32(quads.quads[index].pointers.x);  
                }
            } else {
                if (node_y <= boundary.y + boundary.h / 2.0) {
                    index = u32(quads.quads[index].pointers.w);
                } else {
                    index = u32(quads.quads[index].pointers.y);
                }
            }
            if (index == 0u || counter > uniforms.nodes_length * 4u) {
                quads.quads[0].test = f32(i);
                break;
            }
        }
        if (counter > uniforms.nodes_length * 4u) {
            break;
        }
    }
    quads.quads[2].test = f32(counter);
}
`;
export const  create_sourcelist = `struct Edges {
    edges : array<u32>,
};
struct UintArray {
    a : array<u32>,
};
struct EdgeInfo {
    source_start : u32,
    source_degree : u32,
    target_start : u32,
    target_degree : u32,
}
struct EdgeInfoArray {
    a : array<EdgeInfo>,
};
struct Uniforms {
    nodes_length : u32,
    edges_length : u32,
    cooling_factor : f32,
    ideal_length : f32,
};

@group(0) @binding(0) var<storage, read_write> edges : Edges;
@group(0) @binding(1) var<storage, read_write> edge_info : EdgeInfoArray;
@group(0) @binding(2) var<storage, read_write> source_list : UintArray;
@group(0) @binding(3) var<uniform> uniforms : Uniforms;

@stage(compute) @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    var counter : u32 = 0u;
    var source : u32 = 0u;
    // expects edges to be sorted by source id
    for (var i : u32 = 0u; i < uniforms.edges_length; i = i + 2u) {
        var new_source : u32 = edges.edges[i];
        var target : u32 = edges.edges[i + 1u];
        edge_info.a[new_source].source_degree = edge_info.a[new_source].source_degree + 1u;
        source_list.a[counter] = target;
        if (new_source != source || i == 0u) {
            edge_info.a[new_source].source_start = counter;
        }
        counter = counter + 1u;
        source = new_source;
    }
}`;
export const  create_targetlist = `struct Edges {
    edges : array<u32>,
};
struct UintArray {
    a : array<u32>,
};
struct EdgeInfo {
    source_start : u32,
    source_degree : u32,
    target_start : u32,
    target_degree : u32,
}
struct EdgeInfoArray {
    a : array<EdgeInfo>,
};
struct Uniforms {
    nodes_length : u32,
    edges_length : u32,
    cooling_factor : f32,
    ideal_length : f32,
};

@group(0) @binding(0) var<storage, read_write> edges : Edges;
@group(0) @binding(1) var<storage, read_write> edge_info : EdgeInfoArray;
@group(0) @binding(2) var<storage, read_write> target_list : UintArray;
@group(0) @binding(3) var<uniform> uniforms : Uniforms;

@stage(compute) @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    var counter : u32 = 0u;
    var target : u32 = 0u;
    // expects edges to be sorted by target id
    for (var i : u32 = 0u; i < uniforms.edges_length; i = i + 2u) {
        var source : u32 = edges.edges[i];
        var new_target : u32 = edges.edges[i + 1u];
        edge_info.a[new_target].target_degree = edge_info.a[new_target].target_degree + 1u;
        target_list.a[counter] = source;
        if (new_target != target || i == 0u) {
            edge_info.a[new_target].target_start = counter;
        }
        counter = counter + 1u;
        target = new_target;
    }
}`;
export const  compute_attractive_new = `struct Node {
    value : f32,
    x : f32,
    y : f32,
    size : f32,
};
struct Nodes {
    nodes : array<Node>,
};
struct Forces {
    forces : array<f32>,
};
struct UintArray {
    a : array<u32>,
};
struct EdgeInfo {
    source_start : u32,
    source_degree : u32,
    target_start : u32,
    target_degree : u32,
}
struct EdgeInfoArray {
    a : array<EdgeInfo>,
};
struct Uniforms {
    nodes_length : u32,
    edges_length : u32,
    cooling_factor : f32,
    ideal_length : f32,
};

@group(0) @binding(0) var<storage, read_write> edge_info : EdgeInfoArray;
@group(0) @binding(1) var<storage, read> source_list : UintArray;
@group(0) @binding(2) var<storage, read> target_list : UintArray;
@group(0) @binding(3) var<storage, read_write> forces : Forces;
@group(0) @binding(4) var<storage, read> nodes : Nodes;
@group(0) @binding(5) var<uniform> uniforms : Uniforms;

@stage(compute) @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let l : f32 = uniforms.ideal_length;
    var node : Node = nodes.nodes[global_id.x];
    var a_force : vec2<f32> = vec2<f32>(0.0, 0.0);
    var info : EdgeInfo = edge_info.a[global_id.x];
    // Accumulate forces where node is the source
    for (var i : u32 = info.source_start; i < info.source_start + info.source_degree; i = i + 1u) {
        var node2 : Node = nodes.nodes[source_list.a[i]];
        var dist : f32 = distance(vec2<f32>(node.x, node.y), vec2<f32>(node2.x, node2.y));
        if(dist > 0.0000001) {
            var dir : vec2<f32> = normalize(vec2<f32>(node2.x, node2.y) - vec2<f32>(node.x, node.y));
            a_force = a_force + ((dist * dist) / l) * dir;
        }
    }
    // Accumulate forces where node is the target
    for (var i : u32 = info.target_start; i < info.target_start + info.target_degree; i = i + 1u) {
        var node2 : Node = nodes.nodes[target_list.a[i]];
        var dist : f32 = distance(vec2<f32>(node.x, node.y), vec2<f32>(node2.x, node2.y));
        if(dist > 0.0000001) {
            var dir : vec2<f32> = normalize(vec2<f32>(node2.x, node2.y) - vec2<f32>(node.x, node.y));
            a_force = a_force + ((dist * dist) / l) * dir;
        }
    }
    forces.forces[global_id.x * 2u] = a_force.x;
    forces.forces[global_id.x * 2u + 1u] = a_force.y;
}`;
