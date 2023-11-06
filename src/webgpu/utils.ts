export function getBuffer(device: GPUDevice, arr: Float32Array | Uint32Array, usage = GPUBufferUsage.STORAGE) {
    const desc = {
        size: Math.max(Math.ceil(arr.byteLength / 4) * 4, 16),
        usage,
        mappedAtCreation: true
    };
    const buffer = device.createBuffer(desc);
    const mappedRange = buffer.getMappedRange();
    const writeArray = arr instanceof Uint32Array ? new Uint32Array(mappedRange) : new Float32Array(mappedRange);
    writeArray.set(arr);
    buffer.unmap();
    return buffer;
}

export function getUniformBuffer(device: GPUDevice, type = 'float', value = 0, usage = GPUBufferUsage.UNIFORM, size = 4) {
    const buffer = device.createBuffer({ size, mappedAtCreation: true, usage });
    const mappedRange = buffer.getMappedRange();
    switch (type) {
        case 'uint': new Uint32Array(mappedRange)[0] = value; break;
        case 'int': new Int32Array(mappedRange)[0] = value; break;
        default: new Float32Array(mappedRange)[0] = value;
    }
    buffer.unmap();
    return buffer;
}