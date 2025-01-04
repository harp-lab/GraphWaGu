const cluster_size = CHANGEMEu;
struct Node {
    value : f32,
    x : f32,
    y : f32,
    size : f32,
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
    theta: f32,
    cluster_size: u32,
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
    code : u32,
    level : u32,
    test2: u32,
    test3: u32,
    pointers : array<u32, cluster_size>,
};

@group(0) @binding(0) var<storage, read> indices : array<u32>;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;
@group(0) @binding(2) var<uniform> tree_info : TreeInfo;
@group(0) @binding(3) var<storage, read_write> bounding : Range;
@group(0) @binding(4) var<storage, read_write> tree : array<TreeNode>;

// Find the level above where two Morton codes first disagree
fn find_morton_split_level(morton1: u32, morton2: u32) -> u32 {
    // XOR the Morton codes to find differing bits
    let diff = morton1 ^ morton2;
    
    // If codes are identical, return 16
    if (diff == 0u) {
        return 16u;
    }
    
    // Find position of highest different bit
    var highest_diff_bit = 31u;
    var temp = diff;
    
    // Count leading zeros
    while ((temp & 0x80000000u) == 0u) {
        temp = temp << 1u;
        highest_diff_bit = highest_diff_bit - 1u;
    }
    
    // Convert bit position to level
    let level = 16u - (highest_diff_bit + 2u) / 2u;
    return level;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let x_min = f32(bounding.x_min) / 1000.0;
    let x_max = f32(bounding.x_max) / 1000.0;
    let y_min = f32(bounding.y_min) / 1000.0;
    let y_max = f32(bounding.y_max) / 1000.0;
    let step = tree_info.step;
    var idx = global_id.x * cluster_size;
    var start = f32(uniforms.nodes_length);
    var end = uniforms.nodes_length;
    for (var i = 0u; i < step; i++) {
        idx += u32(start);
        start = ceil(start / f32(cluster_size));
        end += u32(start);
    }
    if (idx >= end) {
        return;
    }
    var pointers = array<u32, cluster_size>();
    if (step == 0u) {
        for (var i = 0u; i < cluster_size; i++) {
            if (idx + i >= end) {
                pointers[i] = 0;
            } else {
                pointers[i] = indices[idx + i] + 1;
            }
        }
    } else {
        for (var i = 0u; i < cluster_size; i++) {
             if (idx + i >= end) {
                pointers[i] = 0;
            } else {
                pointers[i] = idx + i + 1;
            }
        }
    }
    var node = tree[pointers[0]];
    var code = node.code;
    var level = node.level;
    var mass = node.mass;
    var CoM = node.CoM;
    for (var i = 1u; i < cluster_size; i++) {
        if (idx + i >= end) {
            break;
        }
        node = tree[pointers[i]];
        level = min(find_morton_split_level(code, node.code), min(level, node.level));
        CoM = (mass * CoM + node.mass * node.CoM) / (mass + node.mass);
        mass = mass + node.mass;
    }
    tree[end + global_id.x + 1] = TreeNode(
        vec4<f32>(0.0, 0.0, (1.0 / f32(1u << level)) * (x_max - x_min), (1.0 / f32(1u << level)) * (y_max - y_min)),
        CoM,
        mass, 
        0u, 
        code, level, 0u, 0u,
        pointers,
    );
    //  PROBLEM WITH POINTERS ARRAY
    // let node1 = tree[pointers[0]];
    // let node2 = tree[pointers[1]];
    // let node3 = tree[pointers[2]];
    // let node4 = tree[pointers[3]];
    // let morton1 = node1.code;
    // let morton2 = node2.code;
    // let morton3 = node3.code;
    // let morton4 = node4.code;
    // if (idx == end - 1) {
    //     // Just write the node out without merging with anything
    //     tree[end + global_id.x + 1] = node1;
    //     return;
    // }
    // if (idx == end - 2) {
    //     let level = min(find_morton_split_level(morton1, morton2), min(node1.level, node2.level));
    //     tree[end + global_id.x + 1] = TreeNode(
    //         vec4<f32>(0.0, 0.0, 1.0 / f32(1u << level), 1.0 / f32(1u << level)),
    //         (node1.mass * node1.CoM + node2.mass * node2.CoM) / (node1.mass + node2.mass),
    //         node1.mass + node2.mass, 
    //         morton2, 
    //         pointers,
    //         morton1, level
    //     );
    //     return;
    // }
    // if (idx == end - 3) {
    //     let level = min(min(find_morton_split_level(morton3, morton2), min(find_morton_split_level(morton1, morton2), min(node1.level, node2.level))), node3.level);
    //     tree[end + global_id.x + 1] = TreeNode(
    //         vec4<f32>(0.0, 0.0, 1.0 / f32(1u << level), 1.0 / f32(1u << level)),
    //         (node1.mass * node1.CoM + node2.mass * node2.CoM + node3.mass * node3.CoM) / (node1.mass + node2.mass + node3.mass),
    //         node1.mass + node2.mass + node3.mass, 
    //         morton2, 
    //         pointers,
    //         morton1, level
    //     );
    //     return;
    // }
    // let level12 = min(find_morton_split_level(morton1, morton2), min(node1.level, node2.level));
    // let level34 = min(find_morton_split_level(morton3, morton4), min(node3.level, node4.level));
    // let level = min(find_morton_split_level(morton2, morton3), min(level12, level34));
    // tree[end + global_id.x + 1] = TreeNode(
    //     vec4<f32>(0.0, 0.0, 1.0 / f32(1u << level), 1.0 / f32(1u << level)),
    //     (node1.mass * node1.CoM + node2.mass * node2.CoM + node3.mass * node3.CoM + node4.mass * node4.CoM) / (node1.mass + node2.mass + node3.mass + node4.mass),
    //     node1.mass + node2.mass + node3.mass + node4.mass, 
    //     morton2, 
    //     pointers,
    //     morton1, level
    // );
}
