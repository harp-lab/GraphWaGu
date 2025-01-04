struct Node {
    value : f32,
    x : f32,
    y : f32,
    size : f32,
};
struct Edges {
    edges : array<u32>,
};
struct Uniforms {
    nodes_length : u32,
    edges_length : u32,
    cooling_factor : f32,
    ideal_length : f32,
};
struct TreeInfo {
    step : u32,
    max_index : u32,
    theta : f32,
};
struct Range {
    x_min : i32,
    x_max : i32,
    y_min : i32,
    y_max : i32,
};
struct TreeNode {
    // x, y, width, height
    boundary : vec4<f32>,
    CoM : vec2<f32>,
    mass : f32,
    test : u32,
    pointers : vec4<u32>,
    morton_code : u32,
    level : u32
};

@group(0) @binding(0) var<storage, read> nodes : array<Node>;
@group(0) @binding(1) var<storage, read_write> forces : array<f32>;
@group(0) @binding(2) var<uniform> uniforms : Uniforms;
@group(0) @binding(3) var<uniform> tree_info : TreeInfo;
@group(0) @binding(4) var<storage, read> tree : array<TreeNode>;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    var stack = array<u32, 64>();
    let l : f32 = uniforms.ideal_length;
    var index : u32 = global_id.x;
    if (index >= uniforms.nodes_length) {
        return;
    }
    let node = nodes[index];
    var theta : f32 = tree_info.theta;
    var r_force : vec2<f32> = vec2<f32>(0.0, 0.0);
    var a_force : vec2<f32> = vec2<f32>(forces[index * 2u], forces[index * 2u + 1u]);
    var tree_idx : u32 = tree_info.max_index;
    var counter : u32 = 0u;
    var out : u32 = 0u;
    loop {
        out = out + 1u;
        // if (out == 1000u) {
        //     break;
        // }
        var tree_node = tree[tree_idx];
        let dist : f32 = distance(vec2<f32>(node.x, node.y), tree_node.CoM);
        let s : f32 = 2.0 * tree_node.boundary.w;
        if (theta > s / dist) {
            var dir : vec2<f32> = normalize(vec2<f32>(node.x, node.y) - tree_node.CoM);
            r_force = r_force + tree_node.mass * ((l * l) / dist) * dir;
        } else {
            for (var i : u32 = 0u; i < 4u; i = i + 1u) {
                let child : u32 = tree_node.pointers[i];
                if (child == 0 || tree[child].mass < 1.0) {
                    continue;
                } else {
                    if (tree[child].mass > 1.0) {
                        stack[counter] = child;
                        counter = counter + 1u;
                    } else {
                        let dist : f32 = distance(vec2<f32>(node.x, node.y), tree[child].CoM);
                        if (dist > 0.0) {
                            var dir : vec2<f32> = normalize(vec2<f32>(node.x, node.y) - tree[child].CoM);
                            r_force = r_force + ((l * l) / dist) * dir;
                        }
                    }
                }
            }
        }
        counter--;
        if (counter < 0u) {
            break;
        }
        tree_idx = stack[counter];
        if (tree_idx == 0u) {
            break;
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
    if (force.x > uniforms.cooling_factor) {
        force.x = 0.0;
    }
    if (force.y > uniforms.cooling_factor) {
        force.y = 0.0;
    }
    forces[index * 2u] = force.x;
    forces[index * 2u + 1u] = force.y;
}
