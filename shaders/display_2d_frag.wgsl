// Fragment shader
struct Pixels {
    pixels : array<f32>,
};
struct Uniforms {
    peak_value : f32,
    valley_value : f32,
};
struct Image {
    width : u32,
    height : u32,
};

@group(0) @binding(0) var myTexture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read> pixels : Pixels;
@group(0) @binding(2) var<uniform> uniforms : Uniforms;
@group(0) @binding(3) var<uniform> image_size : Image;

fn outside_grid(p : vec2<u32>) -> bool {
    return any(p == vec2<u32>(u32(0))) || p.x == image_size.width || p.y == image_size.height;
}

@stage(fragment)
fn main(@location(0) fragPosition: vec4<f32>) -> @location(0) vec4<f32> {
    var ufragPos : vec4<u32> = vec4<u32>(fragPosition * f32(image_size.width));
    var pixelIndex : u32 = ufragPos.x + ufragPos.y * image_size.width;
    var value : f32 = pixels.pixels[pixelIndex];
    if (!outside_grid(ufragPos.xy)){
        var neighbor_peaks : vec4<bool> = vec4<bool>(
            pixels.pixels[pixelIndex - image_size.width] >= uniforms.peak_value ,
            pixels.pixels[pixelIndex - u32(1)] >= uniforms.peak_value,
            pixels.pixels[pixelIndex + u32(1)] >= uniforms.peak_value,
            pixels.pixels[pixelIndex + image_size.width] >= uniforms.peak_value
        );
        var neighbor_valleys : vec4<bool> = vec4<bool>(
            pixels.pixels[pixelIndex - image_size.width] <= uniforms.valley_value,
            pixels.pixels[pixelIndex - u32(1)] <= uniforms.valley_value,
            pixels.pixels[pixelIndex + u32(1)] <= uniforms.valley_value,
            pixels.pixels[pixelIndex + image_size.width] <= uniforms.valley_value
        ); 
        if (any(neighbor_peaks) && value < uniforms.peak_value) {
            return vec4<f32>(0.8, 0.5, 0.5, 1.0);
        }
        if (any(neighbor_valleys) && value > uniforms.valley_value) {
            return vec4<f32>(0.5, 0.3, 0.3, 1.0);
        }
    }
    var color : vec4<f32> = textureLoad(myTexture, vec2<i32>(i32(value * 180.0), 1), 0);
    return color;
}