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
    max_index : u32
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

// Convert morton code to quadrant boundaries
fn morton_to_rectangle(morton: u32, level: u32) -> vec4<f32> {    
    // Initialize normalized coordinates
    var x = 0.0;
    var y = 0.0;
    var size = 1.0;
    
    // Process each pair of bits from most significant to least
    for(var i = 0u; i < level; i++) {
        size *= 0.5; // Each level divides size by 2
        let shift = (15u - i) * 2u;
        let bits = (morton >> shift) & 3u; // Get pair of bits
        
        // Update position based on quadrant
        switch bits {
            case 0u: { // 00: bottom left
                // Position stays the same
            }
            case 1u: { // 01: bottom right
                x += size;
            }
            case 2u: { // 10: top left
                y += size;
            }
            case 3u: { // 11: top right
                x += size;
                y += size;
            }
            default: {}
        }
    }
    
    // Convert from normalized coordinates to world space
    let x_min = f32(bounding.x_min) / 1000.0;
    let x_max = f32(bounding.x_max) / 1000.0;
    let y_min = f32(bounding.y_min) / 1000.0;
    let y_max = f32(bounding.y_max) / 1000.0;
    
    let world_x = x * (x_max - x_min) + x_min;
    let world_y = y * (y_max - y_min) + y_min;
    let world_w = size * (x_max - x_min);
    let world_h = size * (y_max - y_min);
    
    return vec4<f32>(world_x, world_y, world_w, world_h);
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let test = bounding;
    let step = tree_info.step;
    var idx = global_id.x * 4;
    var start = f32(uniforms.nodes_length);
    var end = uniforms.nodes_length;
    for (var i = 0u; i < step; i++) {
        idx += u32(start);
        start = ceil(start / 4);
        end += u32(start);
    }
    if (idx >= end) {
        return;
    }
    var pointer1 = 0u;
    var pointer2 = 0u;
    var pointer3 = 0u;
    var pointer4 = 0u;
    if (step == 0u) {
        pointer1 = indices[idx];
        pointer2 = indices[idx + 1];
        pointer3 = indices[idx + 2];
        pointer4 = indices[idx + 3];
    } else {
        pointer1 = idx;
        pointer2 = idx + 1;
        pointer3 = idx + 2;
        pointer4 = idx + 3;
    }
    let node1 = tree[pointer1 + 1];
    let node2 = tree[pointer2 + 1];
    let node3 = tree[pointer3 + 1];
    let node4 = tree[pointer4 + 1];
    let morton1 = node1.morton_code;
    let morton2 = node2.morton_code;
    let morton3 = node3.morton_code;
    let morton4 = node4.morton_code;
    if (idx == end - 1) {
        // Just write the node out without merging with anything
        tree[end + global_id.x + 1] = node1;
        return;
    }
    if (idx == end - 2) {
        let level = min(find_morton_split_level(morton1, morton2), min(node1.level, node2.level));
        tree[end + global_id.x + 1] = TreeNode(
            vec4<f32>(0.0, 0.0, 1.0 / f32(1u << level), 1.0 / f32(1u << level)),
            (node1.mass * node1.CoM + node2.mass * node2.CoM) / (node1.mass + node2.mass),
            node1.mass + node2.mass, 
            morton2, 
            vec4<u32>(pointer1 + 1, pointer2 + 1, 0, 0),
            morton1, level
        );
        return;
    }
    if (idx == end - 3) {
        let level = min(min(find_morton_split_level(morton3, morton2), min(find_morton_split_level(morton1, morton2), min(node1.level, node2.level))), node3.level);
        tree[end + global_id.x + 1] = TreeNode(
            vec4<f32>(0.0, 0.0, 1.0 / f32(1u << level), 1.0 / f32(1u << level)),
            (node1.mass * node1.CoM + node2.mass * node2.CoM + node3.mass * node3.CoM) / (node1.mass + node2.mass + node3.mass),
            node1.mass + node2.mass + node3.mass, 
            morton2, 
            vec4<u32>(pointer1 + 1, pointer2 + 1, pointer3 + 1, 0),
            morton1, level
        );
        return;
    }
    let level12 = min(find_morton_split_level(morton1, morton2), min(node1.level, node2.level));
    let level34 = min(find_morton_split_level(morton3, morton4), min(node3.level, node4.level));
    let level = min(find_morton_split_level(morton2, morton3), min(level12, level34));
    tree[end + global_id.x + 1] = TreeNode(
        vec4<f32>(0.0, 0.0, 1.0 / f32(1u << level), 1.0 / f32(1u << level)),
        (node1.mass * node1.CoM + node2.mass * node2.CoM + node3.mass * node3.CoM + node4.mass * node4.CoM) / (node1.mass + node2.mass + node3.mass + node4.mass),
        node1.mass + node2.mass + node3.mass + node4.mass, 
        morton2, 
        vec4<u32>(pointer1 + 1, pointer2 + 1, pointer3 + 1, pointer4 + 1),
        morton1, level
    );
}
