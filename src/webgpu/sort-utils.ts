import { GPUSorter } from './sort'; // Assuming GPUSorter is in a separate file

export function uploadToBuffer(
    encoder: GPUCommandEncoder,
    device: GPUDevice,
    buffer: GPUBuffer,
    values: Uint32Array
): void {
    const stagingBuffer = device.createBuffer({
        label: "Staging buffer",
        size: values.byteLength,
        usage: GPUBufferUsage.COPY_SRC,
        mappedAtCreation: true,
    });

    new Uint32Array(stagingBuffer.getMappedRange()).set(values);
    stagingBuffer.unmap();

    encoder.copyBufferToBuffer(
        stagingBuffer,
        0,
        buffer,
        0,
        values.byteLength
    );
}

export async function downloadBuffer(
    device: GPUDevice,
    buffer: GPUBuffer,
): Promise<Uint32Array> {
    const downloadBuffer = device.createBuffer({
        label: "Download buffer",
        size: buffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
        buffer,
        0,
        downloadBuffer,
        0,
        buffer.size
    );

    device.queue.submit([commandEncoder.finish()]);

    await downloadBuffer.mapAsync(GPUMapMode.READ);
    var result = new Uint32Array(downloadBuffer.getMappedRange());

    return result;
}

export async function testSort(sorter: GPUSorter, device: GPUDevice): Promise<boolean> {
    // simply runs a small sort and check if the sorting result is correct
    const n = 8192; // means that 2 workgroups are needed for sorting
    const scrambledData = new Uint32Array(n);
    
    for (let i = 0; i < n; i++) {
        scrambledData[i] = n - 1 - i;
    }

    const sortBuffers = sorter.createSortBuffers(n);

    const commandEncoder = device.createCommandEncoder({label: "Test sort"});
    uploadToBuffer(commandEncoder, device, sortBuffers.keys, scrambledData);

    sorter.sort(commandEncoder, device.queue, sortBuffers);
    device.queue.submit([commandEncoder.finish()]);

    await device.queue.onSubmittedWorkDone();

    const sorted = await downloadBuffer(
        device,
        sortBuffers.keys,
    );
    console.log(sorted);

    return sorted.every((value, index) => index > n - 1 ? 1 : value === index);
}

export async function guessWorkgroupSize(device: GPUDevice): Promise<number | undefined> {
    console.debug("Searching for the maximum subgroup size (WebGPU currently does not allow querying subgroup sizes)");

    const subgroupSizes = [1, 8, 16, 32, 64, 128];
    let best: number | undefined;

    for (const subgroupSize of subgroupSizes) {
        console.debug(`Checking sorting with subgroup size ${subgroupSize}`);

        const curSorter = new GPUSorter(device, subgroupSize);
        const sortSuccess = await testSort(curSorter, device);

        console.debug(`${subgroupSize} worked: ${sortSuccess}`);

        if (!sortSuccess) {
            break;
        } else {
            best = subgroupSize;
        }
    }

    return best;
}