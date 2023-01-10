fn sigmoid(x: f32) -> f32 {
    return 1.0 / (1.0 + exp(-1.0 * x));
}

@fragment
fn main(@location(0) position: vec2<f32>, @location(1) @interpolate(flat) center: vec2<f32>) -> @location(0) vec4<f32> {
    if (distance(position, center) > 0.002) {
        discard;
    }
    return vec4<f32>(0.0, 0.0, 0.0, 1.0 - distance(position, center) * 500.0);
}
