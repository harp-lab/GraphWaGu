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
    test : f32,
    pointers : vec2<u32>,
    morton_code : u32,
    level : u32
};

@group(0) @binding(0) var<storage, read> nodes : array<Node>;
@group(0) @binding(1) var<storage, read_write> morton_codes : array<u32>;
@group(0) @binding(2) var<uniform> uniforms : Uniforms;
@group(0) @binding(3) var<storage, read_write> bounding : Range;
@group(0) @binding(4) var<storage, read_write> morton_indices : array<u32>;
@group(0) @binding(5) var<storage, read_write> tree : array<TreeNode>;

// Spreads bits by inserting 0s between each bit
fn spread_bits(x: u32) -> u32 {
    var x_mut = x & 0x0000FFFF;  // Mask to ensure we only use lower 16 bits
    x_mut = (x_mut | (x_mut << 8)) & 0x00FF00FF;
    x_mut = (x_mut | (x_mut << 4)) & 0x0F0F0F0F;
    x_mut = (x_mut | (x_mut << 2)) & 0x33333333;
    x_mut = (x_mut | (x_mut << 1)) & 0x55555555;
    return x_mut;
}

// Converts float in [0,1] to fixed-point integer
// TODO: precision lost here
fn float_to_fixed(f: f32) -> u32 {
    return u32(f * 65535.0);  // 2^16 - 1
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

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let idx = global_id.x;
    if (idx >= uniforms.nodes_length) {
        return;
    }
    let node = nodes[idx];
    
    // Convert floats to fixed-point
    let x_min = f32(bounding.x_min) / 1000.0;
    let x_max = f32(bounding.x_max) / 1000.0;
    let y_min = f32(bounding.y_min) / 1000.0;
    let y_max = f32(bounding.y_max) / 1000.0;
    let x_fixed = float_to_fixed((node.x - x_min) / (x_max - x_min));
    let y_fixed = float_to_fixed((node.y - y_min) / (y_max - y_min));
    
    // Compute Morton code by interleaving bits
    let morton = spread_bits(x_fixed) | (spread_bits(y_fixed) << 1);
    
    // Store result
    morton_codes[idx] = morton;
    morton_indices[idx] = idx;
    tree[idx] = TreeNode(
        morton_to_rectangle(morton, 16),
        vec2<f32>(node.x, node.y),
        1.0, 0.0, vec2<u32>(0u),
        morton, 16u
    );
}
