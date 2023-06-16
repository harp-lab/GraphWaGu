import apply_forces from './apply_forces.wgsl';
import compute_attractive_forces from './compute_attractive_forces.wgsl';
import compute_repulsive_forces from './compute_repulsive_forces.wgsl';
import create_adjacency_matrix from './create_adjacency_matrix.wgsl';
import compute_forces from './compute_forces.wgsl';
import create_quadtree from './create_quadtree.wgsl';
import compute_attract_forces from './compute_attract_forces.wgsl';
import compute_forcesBH from './compute_forcesBH.wgsl';
import compute_attractive_new from './compute_attractive_new.wgsl';
import create_targetlist from './create_targetlist.wgsl';
import create_sourcelist from './create_sourcelist.wgsl';


export default {
    apply_forces,
    compute_attractive_forces,
    compute_repulsive_forces,
    create_adjacency_matrix,
    compute_forces,
    create_quadtree,
    compute_attract_forces,
    compute_forcesBH,
    compute_attractive_new,
    create_targetlist,
    create_sourcelist
}