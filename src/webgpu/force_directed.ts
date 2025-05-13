import {apply_forces} from './wgsl-shaders';
import {create_targetlist} from './wgsl-shaders';
import {create_sourcelist} from './wgsl-shaders';
import {compute_forcesBH} from './wgsl-shaders';
import {compute_attractive_new} from './wgsl-shaders';
import {morton_codes} from './wgsl-shaders';
import {create_tree} from './wgsl-shaders';
import { GPUSorter } from './sort';

export class ForceDirected {
    public sorter: GPUSorter;
    public paramsBuffer: GPUBuffer;
    public nodeDataBuffer: GPUBuffer;
    public edgeDataBuffer: GPUBuffer;
    public forceDataBuffer: GPUBuffer;
    public coolingFactor: number = 0.985;
    public device: GPUDevice;
    public createTreePipeline: GPUComputePipeline;
    public createSourceListPipeline: GPUComputePipeline;
    public createTargetListPipeline: GPUComputePipeline;
    public computeAttractivePipeline: GPUComputePipeline;
    public computeForcesBHPipeline: GPUComputePipeline;
    public applyForcesPipeline: GPUComputePipeline;
    public iterationCount: number = 10000;
    public force: number = 1000.0;
    public mortonCodePipeline: GPUComputePipeline;
    public mortonCodeBuffer: GPUBuffer;
    public energy: number = 0.1;
    public theta: number = 2;
    public l: number = 0.01;
    public stopForce: boolean = false;
    clusterSize: number;
    public nodeLength: number;
    public edgeLength: number;
    sourceEdgeDataBuffer: GPUBuffer;
    targetEdgeDataBuffer: GPUBuffer;

    constructor(device: GPUDevice) {
        this.device = device;
        this.sorter = new GPUSorter(this.device, 32);
        this.clusterSize = 4;
        this.nodeLength = 0;
        this.edgeLength = 0;

        this.nodeDataBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.mortonCodeBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.edgeDataBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.sourceEdgeDataBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.targetEdgeDataBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.forceDataBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        this.createTreePipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: create_tree.replace(/CHANGEME/g, this.clusterSize.toString())
                }),
                entryPoint: "main",
            },
        });

        this.mortonCodePipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: morton_codes.replace(/CHANGEME/g, this.clusterSize.toString())
                }),
                entryPoint: "main",
            }
        });

        this.createSourceListPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: create_sourcelist
                }),
                entryPoint: "main",
            },
        });

        this.createTargetListPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: create_targetlist
                }),
                entryPoint: "main",
            },
        });

        this.computeAttractivePipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: compute_attractive_new
                }),
                entryPoint: "main",
            },
        });

        this.computeForcesBHPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: compute_forcesBH.replace(/CHANGEME/g, this.clusterSize.toString()),
                }),
                entryPoint: "main",
            },
        });

        this.applyForcesPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: apply_forces,
                }),
                entryPoint: "main",
            },
        });

        // Create a buffer to store the params, output, and min/max
        this.paramsBuffer = device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    stopForces() {
        this.stopForce = true;
    }

    formatToD3Format(positionList: number[], edgeList: number[], nLength: number, eLength: number) {
        const nodeArray = new Array(nLength);
        const edgeArray = new Array(eLength / 2);

        for (let i = 0; i < 4 * nLength; i = i + 4) {
            nodeArray[i / 4] = {
                index: i / 4,
                name: (i / 4).toString(),
                x: positionList[i + 1],
                y: positionList[i + 2]
            };
        }

        for (let i = 0; i < eLength; i = i + 2) {
            let sourceIndex = edgeList[i];
            let targetIndex = edgeList[i + 1];

            edgeArray[i / 2] = {};

            edgeArray[i / 2].index = i / 2;
            edgeArray[i / 2].source = {};
            edgeArray[i / 2].source.index = sourceIndex;
            edgeArray[i / 2].source.name = sourceIndex.toString();
            edgeArray[i / 2].source.x = nodeArray[sourceIndex].x;
            edgeArray[i / 2].source.y = nodeArray[sourceIndex].y;

            edgeArray[i / 2].target = {};
            edgeArray[i / 2].target.index = targetIndex;
            edgeArray[i / 2].target.name = targetIndex.toString();
            edgeArray[i / 2].target.x = nodeArray[targetIndex].x;
            edgeArray[i / 2].target.y = nodeArray[targetIndex].y;
        }

        return { nodeArray, edgeArray }
    }

    setNodeEdgeData(nodes : number[], edges : number[]) {
        this.nodeLength = nodes.length / 4;
        this.edgeLength = edges.length;
        this.nodeDataBuffer = this.device.createBuffer({
            size: nodes.length * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        new Float32Array(this.nodeDataBuffer.getMappedRange()).set(nodes);
        this.nodeDataBuffer.unmap();
        this.mortonCodeBuffer = this.device.createBuffer({
            size: nodes.length,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        this.edgeDataBuffer = this.device.createBuffer({
            size: edges.length * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
            mappedAtCreation: true
        });
        new Uint32Array(this.edgeDataBuffer.getMappedRange()).set(edges);
        this.edgeDataBuffer.unmap();
        type edge = {
            source: number,
            target: number
        }
        const edges2: Array<edge> = [];
        for (let i = 0; i < edges.length; i += 2) {
            edges2.push({source: edges[i], target: edges[i + 1]});
        }
        const sortedBySource = edges2
            .sort((a, b) => a.source - b.source)
            .flatMap(edge => [edge.source, edge.target]);
        const sortedByTarget = edges2
            .slice()
            .sort((a, b) => a.target - b.target)
            .flatMap(edge => [edge.source, edge.target]);
        console.log(sortedBySource);
        console.log(sortedByTarget);
        this.sourceEdgeDataBuffer = this.device.createBuffer({
            size: sortedBySource.length * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
            mappedAtCreation: true
        });
        new Uint32Array(this.sourceEdgeDataBuffer.getMappedRange()).set(sortedBySource);
        this.sourceEdgeDataBuffer.unmap();
        this.targetEdgeDataBuffer = this.device.createBuffer({
            size: sortedByTarget.length * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
            mappedAtCreation: true
        });
        new Uint32Array(this.targetEdgeDataBuffer.getMappedRange()).set(sortedByTarget);
        this.targetEdgeDataBuffer.unmap();
    }

    async runForces(
        coolingFactor = this.coolingFactor, l = this.l,
        energy: number = this.energy, theta: number = this.theta,
        iterationCount = this.iterationCount,
    ) {
        this.stopForce = false;
        // coolingFactor = 0.995;
        // l = 0.01;
        if (this.nodeLength === 0 || this.edgeLength === 0 || this.nodeDataBuffer === null || this.edgeDataBuffer === null) {
            console.log("No data to run");
            return;
        }
        this.l = l;
        this.energy = energy;
        this.theta = theta;
        this.coolingFactor = coolingFactor;
        this.iterationCount = iterationCount;
        const rangeBuffer = this.device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        const bounding = this.device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });

        let mapping = bounding.getMappedRange();
        new Int32Array(mapping).set([0, 1000, 0, 1000]);
        bounding.unmap();
        const bounding2 = this.device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });

        let mapping2 = bounding2.getMappedRange();
        new Int32Array(mapping2).set([1000, -1000, 1000, -1000]);
        bounding2.unmap();
        // this.coolingFactor = 2.0;
        let commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(bounding, 0, rangeBuffer, 0, 4 * 4);
        this.device.queue.submit([commandEncoder.finish()]);
    
        const sortBuffers = this.sorter.createSortBuffers(this.nodeLength);

        // Set up params (node length, edge length) for creating adjacency matrix
        const uploadBuffer = this.device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        mapping = uploadBuffer.getMappedRange();
        new Uint32Array(mapping).set([this.nodeLength, this.edgeLength]);
        new Float32Array(mapping).set([this.coolingFactor, l], 2);
        uploadBuffer.unmap();

        commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(uploadBuffer, 0, this.paramsBuffer, 0, 4 * 4);

        this.device.queue.submit([commandEncoder.finish()]);

        // Create a buffer to store the params, output, and min/max
        const treeInfoBuffer = this.device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(
            treeInfoBuffer,
            8,
            new Float32Array([this.theta]),
            0,
            1
        );

        this.forceDataBuffer = this.device.createBuffer({
            size: this.nodeLength * 2 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });
        const sourceListBuffer = this.device.createBuffer({
            size: this.edgeLength * 2,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        const targetListBuffer = this.device.createBuffer({
            size: this.edgeLength * 2,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        const edgeInfoBuffer = this.device.createBuffer({
            size: this.nodeLength * 4 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        const treeBuffer = this.device.createBuffer({
            size: Math.ceil(this.nodeLength * 2.1) * (12 + Math.max(4, this.clusterSize)) * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        const createSourceListBindGroup = this.device.createBindGroup({
            layout: this.createSourceListPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.sourceEdgeDataBuffer!,
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: edgeInfoBuffer,
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: sourceListBuffer,
                    },
                },
                {
                    binding: 3,
                    resource: {
                        buffer: this.paramsBuffer
                    }
                }
            ]
        });

        const createTargetListBindGroup = this.device.createBindGroup({
            layout: this.createTargetListPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.targetEdgeDataBuffer,
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: edgeInfoBuffer,
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: targetListBuffer,
                    },
                },
                {
                    binding: 3,
                    resource: {
                        buffer: this.paramsBuffer
                    }
                }
            ]
        })
        this.device.queue.submit([commandEncoder.finish()]);
        commandEncoder = this.device.createCommandEncoder();
        // Run create source and target lists pass
        const computePassEncoder = commandEncoder.beginComputePass();
        computePassEncoder.setBindGroup(0, createSourceListBindGroup);
        computePassEncoder.setPipeline(this.createSourceListPipeline);
        computePassEncoder.dispatchWorkgroups(1, 1, 1);
        computePassEncoder.setBindGroup(0, createTargetListBindGroup);
        computePassEncoder.setPipeline(this.createTargetListPipeline);
        computePassEncoder.dispatchWorkgroups(1, 1, 1);
        computePassEncoder.end();
        const gpuReadBuffer = this.device.createBuffer({
            size: this.nodeLength * 4 * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        commandEncoder.copyBufferToBuffer(
            edgeInfoBuffer /* source buffer */,
            0 /* source offset */,
            gpuReadBuffer /* destination buffer */,
            0 /* destination offset */,
            this.nodeLength * 4 * 4 /* size */
        );
        this.device.queue.submit([commandEncoder.finish()]);
        // await this.device.queue.onSubmittedWorkDone();
        // await gpuReadBuffer.mapAsync(GPUMapMode.READ);
        // const arrayBuffer = gpuReadBuffer.getMappedRange();
        // const list = new Uint32Array(arrayBuffer);
        // console.log(list);
        // return;

        // const iterationTimes: Array<number> = [];
        const applyBindGroup = this.device.createBindGroup({
            layout: this.applyForcesPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.nodeDataBuffer,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.forceDataBuffer,
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.paramsBuffer
                    }
                },
                {
                    binding: 3,
                    resource: {
                        buffer: rangeBuffer
                    }
                }
            ],
        });

        const createTreeBindGroup = this.device.createBindGroup({
            layout: this.createTreePipeline.getBindGroupLayout(0),
            entries: [
                // Sort values buffer filled with indices
                {
                    binding: 0,
                    resource: {
                        buffer: sortBuffers.values,
                    }
                },  
                {
                    binding: 1,
                    resource: {
                        buffer: this.paramsBuffer,
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: treeInfoBuffer,
                    }
                },
                {
                    binding: 3,
                    resource: {
                        buffer: rangeBuffer,
                    }
                },
                {
                    binding: 4,
                    resource: {
                        buffer: treeBuffer,
                    }
                },
            ]
        });
        const mortonCodeBindGroup = this.device.createBindGroup({
            layout: this.mortonCodePipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.nodeDataBuffer,
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.mortonCodeBuffer,
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.paramsBuffer,
                    }
                },
                {
                    binding: 3,
                    resource: {
                        buffer: rangeBuffer,
                    }
                },
                // Sort values buffer filled with mor
                {
                    binding: 4,
                    resource: {
                        buffer: sortBuffers.values,
                    }
                },
                {
                    binding: 5,
                    resource: {
                        buffer: treeBuffer,
                    }
                },
            ]
        });
        // const batchBuffer = this.device.createBuffer({
        //     size: 4,
        //     usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
        // });
        let positionReadBuffer = this.device.createBuffer({
            size: this.nodeLength * 4 * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        let numIterations = 0;
        var totalTime = 0;
        var totalTree = 0;
        var start, end;
        const debug = false;
        var totalStart = 0;
        while (numIterations < iterationCount && this.coolingFactor > 0.0001) {
            if (numIterations == 1) {
                totalStart = performance.now();
            }
            const frameStart = performance.now();
            numIterations++;
            // Set up params (node length, edge length)
            const upload = this.device.createBuffer({
                size: 4 * 4,
                usage: GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true,
            });
            const mapping = upload.getMappedRange();
            new Uint32Array(mapping).set([this.nodeLength, this.edgeLength]);
            new Float32Array(mapping).set([this.coolingFactor, l], 2);
            upload.unmap();
            //this.device.createQuerySet({})
            let commandEncoder = this.device.createCommandEncoder();
            //commandEncoder.writeTimestamp();
            commandEncoder.copyBufferToBuffer(upload, 0, this.paramsBuffer, 0, 4 * 4);
            this.device.queue.submit([commandEncoder.finish()]);
            if (debug) {await this.device.queue.onSubmittedWorkDone();}
            start = performance.now();
            commandEncoder = this.device.createCommandEncoder();
            let computePassEncoder = commandEncoder.beginComputePass();
            computePassEncoder.setBindGroup(0, mortonCodeBindGroup);
            computePassEncoder.setPipeline(this.mortonCodePipeline);
            computePassEncoder.dispatchWorkgroups(Math.ceil(this.nodeLength / 128), 1, 1);
            computePassEncoder.end();
            commandEncoder.copyBufferToBuffer(this.mortonCodeBuffer, 0, sortBuffers.keys, 0, this.mortonCodeBuffer.size);
            this.device.queue.submit([commandEncoder.finish()]);
            if (debug) {await this.device.queue.onSubmittedWorkDone();}
            end = performance.now();
            console.log(`Morton codes took ${end - start}ms`)
            {
                // var dbgBuffer = this.device.createBuffer({
                //     size: this.mortonCodeBuffer.size,
                //     usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                // });

                // commandEncoder = this.device.createCommandEncoder();
                // commandEncoder.copyBufferToBuffer(this.mortonCodeBuffer, 0, dbgBuffer, 0, dbgBuffer.size);
                // this.device.queue.submit([commandEncoder.finish()]);
                // await this.device.queue.onSubmittedWorkDone();

                // await dbgBuffer.mapAsync(GPUMapMode.READ);

                // var debugValsf = new Float32Array(dbgBuffer.getMappedRange());
                // console.log(debugValsf);

                var dbgBufferu = this.device.createBuffer({
                    size: this.mortonCodeBuffer.size,
                    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                });

                commandEncoder = this.device.createCommandEncoder();
                commandEncoder.copyBufferToBuffer(this.mortonCodeBuffer, 0, dbgBufferu, 0, dbgBufferu.size);
                this.device.queue.submit([commandEncoder.finish()]);
                await this.device.queue.onSubmittedWorkDone();

                await dbgBufferu.mapAsync(GPUMapMode.READ);

                var debugValsu = new Uint32Array(dbgBufferu.getMappedRange());
                console.log(debugValsu);
            }

            start = performance.now();
            const sortEncoder = this.device.createCommandEncoder();
            this.sorter.sort(sortEncoder, this.device.queue, sortBuffers);
            this.device.queue.submit([sortEncoder.finish()]);
            if (debug) {await this.device.queue.onSubmittedWorkDone();}
            end = performance.now();
            console.log(`Sort took ${end - start} ms`);
            {
                var dbgBuffer = this.device.createBuffer({
                    size: sortBuffers.keys.size,
                    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                });

                commandEncoder = this.device.createCommandEncoder();
                commandEncoder.copyBufferToBuffer(sortBuffers.keys, 0, dbgBuffer, 0, dbgBuffer.size);
                this.device.queue.submit([commandEncoder.finish()]);
                await this.device.queue.onSubmittedWorkDone();

                await dbgBuffer.mapAsync(GPUMapMode.READ);

                var debugValsu = new Uint32Array(dbgBuffer.getMappedRange());
                console.log(debugValsu);
            }
            let startTot = performance.now();
            var maxIndex = this.nodeLength;
            commandEncoder = this.device.createCommandEncoder();
            for (var i = 0; i < Math.log(this.nodeLength) / Math.log(this.clusterSize); i++) {
                // start = performance.now();
                this.device.queue.writeBuffer(
                    treeInfoBuffer,
                    0,
                    new Uint32Array([i]),
                    0,
                    1
                );
                commandEncoder = this.device.createCommandEncoder();
                computePassEncoder = commandEncoder.beginComputePass();
                computePassEncoder.setBindGroup(0, createTreeBindGroup);
                computePassEncoder.setPipeline(this.createTreePipeline);
                computePassEncoder.dispatchWorkgroups(Math.ceil(this.nodeLength / (128 * this.clusterSize**(i+1))), 1, 1);
                computePassEncoder.end();
                this.device.queue.submit([commandEncoder.finish()]);
                // await this.device.queue.onSubmittedWorkDone();
                maxIndex += Math.ceil(this.nodeLength / this.clusterSize**(i+1))
                // end = performance.now();
                // console.log(`Create Tree iter ${i} took ${end - start}ms`)
            }
            this.device.queue.writeBuffer(
                treeInfoBuffer,
                4,
                new Uint32Array([maxIndex]),
                0,
                1
            );
            this.device.queue.submit([commandEncoder.finish()]);
            if (debug) {await this.device.queue.onSubmittedWorkDone();}
            let endTot = performance.now();
            totalTree += endTot - startTot;
            console.log(`Create Tree took ${endTot - startTot}ms`)
            {
                // console.log(this.nodeLength);
                // var dbgBuffer = this.device.createBuffer({
                //     size: treeBuffer.size,
                //     usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                // });

                // commandEncoder = this.device.createCommandEncoder();
                // commandEncoder.copyBufferToBuffer(treeBuffer, 0, dbgBuffer, 0, dbgBuffer.size);
                // this.device.queue.submit([commandEncoder.finish()]);
                // await this.device.queue.onSubmittedWorkDone();

                // await dbgBuffer.mapAsync(GPUMapMode.READ);

                // var debugValsf = new Float32Array(dbgBuffer.getMappedRange());
                // console.log(debugValsf);
                // console.log(maxIndex * 16);
                // var sum_size = 0;
                // for (var tt = this.nodeLength * 16 + 16; tt < maxIndex * 16 + 16; tt += 16) {
                //     sum_size += debugValsf[tt + 2];
                // }
                // console.log(sum_size / (maxIndex - this.nodeLength));
                // total_sumsize += sum_size / (maxIndex - this.nodeLength);
                // dbgBuffer.destroy();
                // var dbgBufferu = this.device.createBuffer({
                //     size: treeBuffer.size,
                //     usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                // });

                // commandEncoder = this.device.createCommandEncoder();
                // commandEncoder.copyBufferToBuffer(treeBuffer, 0, dbgBufferu, 0, dbgBuffer.size);
                // this.device.queue.submit([commandEncoder.finish()]);
                // await this.device.queue.onSubmittedWorkDone();

                // await dbgBufferu.mapAsync(GPUMapMode.READ);

                // var debugValsu = new Uint32Array(dbgBufferu.getMappedRange());
                // console.log(debugValsu);
            }

            commandEncoder = this.device.createCommandEncoder();
            // const commandEncoder = this.device.createCommandEncoder();
            // start = performance.now();
            // Create BH bindgroup
            const computeForcesBHBindGroup = this.device.createBindGroup({
                layout: this.computeForcesBHPipeline.getBindGroupLayout(0),
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.nodeDataBuffer,
                        },
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this.forceDataBuffer,
                        }
                    },
                    {
                        binding: 2,
                        resource: {
                            buffer: this.paramsBuffer,
                        },
                    },
                    {
                        binding: 3,
                        resource: {
                            buffer: treeInfoBuffer
                        }
                    },
                    {
                        binding: 4,
                        resource: {
                            buffer: treeBuffer
                        }
                    }
                ],
            });

            // Run attract forces pass
            const attractBindGroup = this.device.createBindGroup({
                layout: this.computeAttractivePipeline.getBindGroupLayout(0),
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: edgeInfoBuffer,
                        },
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: sourceListBuffer,
                        },
                    },
                    {
                        binding: 2,
                        resource: {
                            buffer: targetListBuffer,
                        },
                    },
                    {
                        binding: 3,
                        resource: {
                            buffer: this.forceDataBuffer,
                        }
                    },
                    {
                        binding: 4,
                        resource: {
                            buffer: this.nodeDataBuffer,
                        }
                    },
                    {
                        binding: 5,
                        resource: {
                            buffer: this.paramsBuffer,
                        },
                    },
                ],
            });
            if (debug) {await this.device.queue.onSubmittedWorkDone();}

            // Run attract forces pass
            computePassEncoder = commandEncoder.beginComputePass();
            computePassEncoder.setBindGroup(0, attractBindGroup);
            computePassEncoder.setPipeline(this.computeAttractivePipeline);
            computePassEncoder.dispatchWorkgroups(Math.ceil(this.nodeLength / 128), 1, 1);
            computePassEncoder.end();

            this.device.queue.submit([commandEncoder.finish()]);
            start = performance.now();
            if (debug) {await this.device.queue.onSubmittedWorkDone();}
            end = performance.now();
            console.log(`attract force time: ${end - start}`)

            // Run compute forces BH pass
            start = performance.now();
            commandEncoder = this.device.createCommandEncoder();

            const pass = commandEncoder.beginComputePass();
            pass.setBindGroup(0, computeForcesBHBindGroup);
            pass.setPipeline(this.computeForcesBHPipeline);
            pass.dispatchWorkgroups(Math.ceil(this.nodeLength / 128), 1, 1);
            pass.end();
            this.device.queue.submit([commandEncoder.finish()]);
            if (debug) {await this.device.queue.onSubmittedWorkDone();}
            end = performance.now();
            console.log(`repulse force time: ${end - start}`)

            {
                // var dbgBuffer = this.device.createBuffer({
                //     size: treeBuffer.size,
                //     usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                // });

                // commandEncoder = this.device.createCommandEncoder();
                // commandEncoder.copyBufferToBuffer(treeBuffer, 0, dbgBuffer, 0, dbgBuffer.size);
                // this.device.queue.submit([commandEncoder.finish()]);
                // await this.device.queue.onSubmittedWorkDone();

                // await dbgBuffer.mapAsync(GPUMapMode.READ);

                // var debugValsf = new Float32Array(dbgBuffer.getMappedRange());
                // console.log(debugValsf);


                // var dbgBufferu = this.device.createBuffer({
                //     size: stackBuffer.size,
                //     usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                // });

                // commandEncoder = this.device.createCommandEncoder();
                // commandEncoder.copyBufferToBuffer(stackBuffer, 0, dbgBufferu, 0, stackBuffer.size);
                // this.device.queue.submit([commandEncoder.finish()]);
                // await this.device.queue.onSubmittedWorkDone();

                // await dbgBufferu.mapAsync(GPUMapMode.READ);

                // var debugValsu = new Uint32Array(dbgBufferu.getMappedRange());
                // console.log(debugValsu);
            }

            commandEncoder = this.device.createCommandEncoder();
            commandEncoder.copyBufferToBuffer(bounding2, 0, rangeBuffer, 0, 4 * 4);

            start = performance.now();
            computePassEncoder = commandEncoder.beginComputePass();
            //commandEncoder.writeTimestamp();


            // Run apply forces pass
            computePassEncoder.setBindGroup(0, applyBindGroup);
            computePassEncoder.setPipeline(this.applyForcesPipeline);
            computePassEncoder.dispatchWorkgroups(Math.ceil(this.nodeLength / (2 * 128)), 1, 1);
            computePassEncoder.end();

            this.device.queue.submit([commandEncoder.finish()]);
            if (debug) {await this.device.queue.onSubmittedWorkDone();}
            end = performance.now();
            console.log(`apply forces time ${end - start}`)
            // iterationTimes.push(end - start);

            // this.maxForceResultBuffer.unmap();
            // Read all of the forces applied.
            // await gpuReadBuffer.mapAsync(GPUMapMode.READ);
            // const arrayBuffer = gpuReadBuffer.getMappedRange();
            // const output = new Int32Array(arrayBuffer);
            // console.log(output);

            // console.log(output[23]);
            // await gpuReadBuffer3.mapAsync(GPUMapMode.READ);
            // const arrayBuffer3 = gpuReadBuffer3.getMappedRange();
            // const output3 = new Float32Array(arrayBuffer3);
            // console.log(output3);
            // await gpuReadBuffer2.mapAsync(GPUMapMode.READ);
            // const arrayBuffer2 = gpuReadBuffer2.getMappedRange();
            // const output2 = new Uint32Array(arrayBuffer2);
            // console.log(output2);
            // for (var m = 0; m < output.length; m += 12) {
            //     const mass = output[m + 10];
            //     if (
            //         output2[m + 4] == 1000000 ||
            //         output2[m + 5] == 1000000 ||
            //         output2[m + 6] == 1000000 ||
            //         output2[m + 7] == 1000000 
            //     ) {
            //         console.log(m);
            //         break;
            //     }
            // }
            // if (output[11] > 0) {
            //     break;
            // }
            this.coolingFactor = this.coolingFactor * 0.975;
            if (debug) {await this.device.queue.onSubmittedWorkDone();}
            const frameEnd = performance.now();
            console.log(`Total frame time: ${frameEnd - frameStart}`);
            totalTime += frameEnd - frameStart;
            if (numIterations % 10 == 0) {
                await this.device.queue.onSubmittedWorkDone();
            }
        }
        await positionReadBuffer.mapAsync(GPUMapMode.READ);

        await this.device.queue.onSubmittedWorkDone();
        const totalEnd = performance.now();

        console.log(`Completed in ${numIterations} iterations with total time ${totalEnd - totalStart} average iteration time ${(totalEnd - totalStart) / (numIterations - 1)}`);


    }
}
