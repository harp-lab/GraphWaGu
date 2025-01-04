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

fn rotate_bits(n: u32, rx: u32, ry: u32, order: u32) -> u32 {
    if (ry == 0u) {
        if (rx == 1u) {
            // Reflect about y=x
            let mask = (1u << order) - 1u;
            return mask - n;
        }
    }
    return n;
}

fn hilbert_xy_to_d(x_in: u32, y_in: u32) -> u32 {
    var d: u32 = 0u;
    var x: u32 = x_in;
    var y: u32 = y_in;
    var rx: u32;
    var ry: u32;
    
    // Process 16 bits of input coordinates
    for(var i: u32 = 0u; i < 16u; i += 1u) {
        let s = 15u - i;
        
        // Extract current bit of x and y from highest positions
        rx = (x >> 15u) & 1u;
        ry = (y >> 15u) & 1u;
        
        // Add position to result
        d |= ((3u * rx) ^ ry) << (2u * s);
        
        // Rotate coordinates if needed for next iteration
        if (ry == 0u) {
            if (rx == 1u) {
                // Reflect about y=x
                x = (1u << 16u) - 1u - x;
                y = (1u << 16u) - 1u - y;
            }
            // Swap x and y
            let t = x;
            x = y;
            y = t;
        }
        
        // Shift coordinates for next iteration
        x = (x << 1u) & 0xFFFFu;
        y = (y << 1u) & 0xFFFFu;
    }
    
    return d;
}

@compute @workgroup_size(64, 1, 1)
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
    let hilbert = hilbert_xy_to_d(x_fixed, y_fixed);
    let code = hilbert;
    
    morton_codes[idx] = code;
    // morton_codes[idx] = morton;
    morton_indices[idx] = idx;
    // tree[idx + 1u] = TreeNode(
    //     morton_to_rectangle(morton, 16),
    //     vec2<f32>(node.x, node.y),
    //     1.0, 0.0, vec4<u32>(0u),
    //     morton, 16u
    // );
    tree[idx + 1u] = TreeNode(
        vec4<f32>(0.0, 0.0, 1.0 / f32(1u << 16u), 1.0 / f32(1u << 16u)),
        vec2<f32>(node.x, node.y),
        1.0, 0u,
        code, 16u, 0u, 0u,
        array<u32, cluster_size>()
    );
}
