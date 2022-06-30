struct Edges {
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
