export const  node_vert = `struct Node {
    value : f32;
    x : f32;
    y : f32;
    size : f32;
};
struct Nodes {
    nodes : array<Node>;
};
struct VertexOutput {
    @builtin(position) Position : vec4<f32>;
    @location(0) position: vec2<f32>;
    @location(1) @interpolate(flat) center : vec2<f32>;
};
struct Uniforms {
  view_box : vec4<f32>;
};
struct Edges {
    edges : array<u32>;
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
    @builtin(position) clip_position: vec4<f32>;
};
struct Uniforms {
  view_box : vec4<f32>;
};
struct Node {
    value : f32;
    x : f32;
    y : f32;
    size : f32;
};
struct Nodes {
    nodes : array<Node>;
};
struct Edges {
    edges : array<u32>;
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
    value : f32;
    x : f32;
    y : f32;
    size : f32;
};
struct Nodes {
    nodes : array<Node>;
};
struct Edges {
    edges : array<u32>;
};
struct Forces {
    forces : array<f32>;
};
struct Uniforms {
    nodes_length : u32;
    edges_length : u32;
    cooling_factor : f32;
    ideal_length : f32;
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
    value : f32;
    x : f32;
    y : f32;
    size : f32;
};
struct Nodes {
    nodes : array<Node>;
};
struct Edges {
    edges : array<u32>;
};
struct Stack {
    a : array<u32>;
}
struct Forces {
    forces : array<f32>;
};
struct Uniforms {
    nodes_length : u32;
    edges_length : u32;
    cooling_factor : f32;
    ideal_length : f32;
};
struct Rectangle {
    x : f32;
    y : f32;
    w : f32;
    h : f32;
};
struct QuadTree {
    boundary : Rectangle;
    NW : f32;
    NE : f32;
    SW : f32;
    SE : f32;
    CoM : vec2<f32>;
    mass : f32;
    test : f32;
};
struct QuadTrees {
    quads : array<QuadTree>;
}
struct Batch {
    batch_id : u32;
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
    value : f32;
    x : f32;
    y : f32;
    size : f32;
};
struct Nodes {
    nodes : array<Node>;
};
struct Edges {
    edges : array<u32>;
};
struct Forces {
    forces : array<f32>;
};
struct Uniforms {
    nodes_length : u32;
    edges_length : u32;
    cooling_factor : f32;
    ideal_length : f32;
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
    value : f32;
    x : f32;
    y : f32;
    size : f32;
};
struct Nodes {
    nodes : array<Node>;
};
struct Forces {
    forces : array<f32>;
};
struct Batch {
    batch_id : u32;
};
struct Uniforms {
    nodes_length : u32;
    edges_length : u32;
    cooling_factor : f32;
    ideal_length : f32;
};
struct Range {
    x_min : atomic<i32>;
    x_max : atomic<i32>;
    y_min : atomic<i32>;
    y_max : atomic<i32>;
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
    edges : array<u32>;
};
struct BoolArray {
    matrix : array<u32>;
};
struct Uniforms {
    nodes_length : u32;
    edges_length : u32;
    cooling_factor : f32;
    ideal_length : f32;
};
struct IntArray {
    matrix : array<i32>;
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
    value : f32;
    x : f32;
    y : f32;
    size : f32;
};
struct Nodes {
    nodes : array<Node>;
};
struct Rectangle {
    x : f32;
    y : f32;
    w : f32;
    h : f32;
};
struct QuadTree {
    boundary : Rectangle;
    // In order NW; NE; SW; SE
    pointers : vec4<f32>;
    CoM : vec2<f32>;
    mass : f32;
    test : f32;
};
struct Uniforms {
    nodes_length : u32;
    edges_length : u32;
    cooling_factor : f32;
    ideal_length : f32;
};
struct QuadTrees {
    quads : array<QuadTree>;
}
struct Range {
    x_min : i32;
    x_max : i32;
    y_min : i32;
    y_max : i32;
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
    edges : array<u32>;
};
struct UintArray {
    a : array<u32>;
};
struct EdgeInfo {
    source_start : u32;
    source_degree : u32;
    target_start : u32;
    target_degree : u32;
}
struct EdgeInfoArray {
    a : array<EdgeInfo>;
};
struct Uniforms {
    nodes_length : u32;
    edges_length : u32;
    cooling_factor : f32;
    ideal_length : f32;
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
    edges : array<u32>;
};
struct UintArray {
    a : array<u32>;
};
struct EdgeInfo {
    source_start : u32;
    source_degree : u32;
    target_start : u32;
    target_degree : u32;
}
struct EdgeInfoArray {
    a : array<EdgeInfo>;
};
struct Uniforms {
    nodes_length : u32;
    edges_length : u32;
    cooling_factor : f32;
    ideal_length : f32;
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
    value : f32;
    x : f32;
    y : f32;
    size : f32;
};
struct Nodes {
    nodes : array<Node>;
};
struct Forces {
    forces : array<f32>;
};
struct UintArray {
    a : array<u32>;
};
struct EdgeInfo {
    source_start : u32;
    source_degree : u32;
    target_start : u32;
    target_degree : u32;
}
struct EdgeInfoArray {
    a : array<EdgeInfo>;
};
struct Uniforms {
    nodes_length : u32;
    edges_length : u32;
    cooling_factor : f32;
    ideal_length : f32;
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
