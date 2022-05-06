#!/usr/bin/env python3
shaders = [
    "compute_terrain.wgsl",
    "normalize_terrain.wgsl",
    "display_2d_vert.wgsl",
    "display_2d_frag.wgsl",
    "display_3d_vert.wgsl",
    "display_3d_frag.wgsl",
    "node_vert.wgsl",
    "node_frag.wgsl",
    "edge_vert.wgsl",
    "edge_frag.wgsl",
    "compute_forces.wgsl",
    "compute_forcesBH.wgsl",
    "compute_attract_forces.wgsl",
    "apply_forces.wgsl",
    "create_adjacency_matrix.wgsl",
    "create_quadtree.wgsl",
    "create_sourcelist.wgsl",
    "create_targetlist.wgsl",
    "compute_attractive_new.wgsl"
]
compiled_shaders = ""

for shader in shaders:
    with open(shader, "r") as f:
        compiled_code = f.read()
        compiled_shaders += f"export const  {shader[:-5]} = `{compiled_code}`;\n"

with open("../src/webgpu/wgsl.tsx", "w") as f:
    f.write(compiled_shaders)

