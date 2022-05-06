// Vertex shader
struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) vray_dir: vec3<f32>,
  @location(1) @interpolate(flat) transformed_eye: vec3<f32>,
};
struct Uniforms {
  proj_view : mat4x4<f32>,
  eye_pos : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : Uniforms;

[[stage(vertex)]]
fn main(@location(0) position : vec3<f32>)
     -> VertexOutput {
    var output : VertexOutput;
    var volume_translation : vec3<f32> = vec3<f32>(-0.5, -0.5, -0.5);
    output.Position = uniforms.proj_view * vec4<f32>(position + volume_translation, 1.0);
    output.transformed_eye = uniforms.eye_pos.xyz - volume_translation;
    output.vray_dir = position - output.transformed_eye;
    return output;
}