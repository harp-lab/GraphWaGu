struct Edges {
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
}