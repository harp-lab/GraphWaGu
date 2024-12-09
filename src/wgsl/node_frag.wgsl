fn sigmoid(x: f32) -> f32 {
    return 1.0 / (1.0 + exp(-1.0 * x));
}

@fragment
fn main(@location(0) position: vec2<f32>, @location(1) @interpolate(flat) center: vec2<f32>, @location(2) color: vec3<f32>) -> @location(0) vec4<f32> {
    if (distance(position, center) > 0.002) {
        discard;
    }
    return vec4<f32>(color.x, color.y, color.z, 1.0);
}
