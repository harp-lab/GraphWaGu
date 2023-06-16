import { RefObject } from 'react';
import {
    apply_forces,
    create_adjacency_matrix,
    compute_forces,
    create_quadtree,
    compute_attract_forces,
    compute_forcesBH,
    compute_attractive_new,
    create_targetlist,
    create_sourcelist,
} from './wgsl';

export class ForceDirected {
    public paramsBuffer: GPUBuffer;
    public nodeDataBuffer: GPUBuffer;
    public edgeDataBuffer: GPUBuffer;
    public adjMatrixBuffer: GPUBuffer;
    public laplacianBuffer: GPUBuffer;
    public quadTreeBuffer: GPUBuffer;
    public forceDataBuffer: GPUBuffer;
    public coolingFactor: number = 0.985;
    public device: GPUDevice;
    public createMatrixPipeline: GPUComputePipeline;
    public createQuadTreePipeline: GPUComputePipeline;
    public createSourceListPipeline: GPUComputePipeline;
    public createTargetListPipeline: GPUComputePipeline;
    public computeAttractiveNewPipeline: GPUComputePipeline;
    public computeForcesPipeline: GPUComputePipeline;
    public computeForcesBHPipeline: GPUComputePipeline;
    public computeAttractForcesPipeline: GPUComputePipeline;
    public applyForcesPipeline: GPUComputePipeline;
    public iterationCount: number = 10000;
    public threshold: number = 100;
    public force: number = 1000.0;

    constructor(device: GPUDevice) {
        this.device = device;

        this.nodeDataBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.edgeDataBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.adjMatrixBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.laplacianBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.quadTreeBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        this.forceDataBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        this.createMatrixPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: create_adjacency_matrix
                }),
                entryPoint: "main",
            },
        });

        this.createQuadTreePipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: create_quadtree
                }),
                entryPoint: "main",
            },
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

        this.computeAttractiveNewPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: compute_attractive_new
                }),
                entryPoint: "main",
            },
        });

        this.computeForcesPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: compute_forces,
                }),
                entryPoint: "main",
            },
        });

        this.computeForcesBHPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: compute_forcesBH,
                }),
                entryPoint: "main",
            },
        });

        this.computeAttractForcesPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({
                    code: compute_attract_forces,
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

    async runForces(
        nodeDataBuffer = this.nodeDataBuffer,
        edgeDataBuffer = this.edgeDataBuffer,
        nodeLength: number = 0, edgeLength: number = 0,
        coolingFactor = this.coolingFactor, l = 0.01,
        iterationCount = this.iterationCount,
        threshold = this.threshold,
        iterRef: RefObject<HTMLLabelElement>,
        sourceEdgeBuffer: GPUBuffer | null,
        targetEdgeBuffer: GPUBuffer | null,
        frame: FrameRequestCallback,
        edgeList: number[]
    ) {
        // coolingFactor = 0.995;
        // l = 0.01;
        if (nodeLength === 0 || edgeLength === 0) {
            return;
        }

        this.coolingFactor = coolingFactor;
        this.nodeDataBuffer = nodeDataBuffer;
        this.edgeDataBuffer = edgeDataBuffer;
        this.threshold = threshold;
        this.force = 100000;
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
        // this.coolingFactor = 2.0;
        let commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(bounding, 0, rangeBuffer, 0, 4 * 4);
        this.device.queue.submit([commandEncoder.finish()]);


        // Set up params (node length, edge length) for creating adjacency matrix
        const upload = this.device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        mapping = upload.getMappedRange();
        new Uint32Array(mapping).set([nodeLength, edgeLength]);
        new Float32Array(mapping).set([this.coolingFactor, l], 2);
        upload.unmap();

        commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(upload, 0, this.paramsBuffer, 0, 4 * 4);

        this.device.queue.submit([commandEncoder.finish()]);


        this.forceDataBuffer = this.device.createBuffer({
            size: nodeLength * 2 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        const quadTreeLength = nodeLength * 12 * 4 * 4;
        this.quadTreeBuffer = this.device.createBuffer({
            size: quadTreeLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        const sourceListBuffer = this.device.createBuffer({
            size: edgeLength * 2,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        const targetListBuffer = this.device.createBuffer({
            size: edgeLength * 2,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        const edgeInfoBuffer = this.device.createBuffer({
            size: nodeLength * 4 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        let entries: GPUBindGroupEntry[] = [
            {
                binding: 0,
                resource: {
                    buffer: sourceEdgeBuffer!,
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
        const createSourceListBindGroup = this.device.createBindGroup({
            layout: this.createSourceListPipeline.getBindGroupLayout(0),
            entries
        });
        entries = [
            {
                binding: 0,
                resource: {
                    buffer: targetEdgeBuffer!,
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

        const createTargetListBindGroup = this.device.createBindGroup({
            layout: this.createTargetListPipeline.getBindGroupLayout(0),
            entries
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
            size: nodeLength * 4 * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        commandEncoder.copyBufferToBuffer(
            edgeInfoBuffer /* source buffer */,
            0 /* source offset */,
            gpuReadBuffer /* destination buffer */,
            0 /* destination offset */,
            nodeLength * 4 * 4 /* size */
        );
        this.device.queue.submit([commandEncoder.finish()]);
        // await this.device.queue.onSubmittedWorkDone();
        // await gpuReadBuffer.mapAsync(GPUMapMode.READ);
        // const arrayBuffer = gpuReadBuffer.getMappedRange();
        // const list = new Uint32Array(arrayBuffer);
        // console.log(list);
        // return;

        // const iterationTimes: Array<number> = [];
        const totalStart = performance.now();
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
        const quadTreeBindGroup = this.device.createBindGroup({
            layout: this.createQuadTreePipeline.getBindGroupLayout(0),
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
                        buffer: this.quadTreeBuffer,
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
                }
            ]
        });
        const batchBuffer = this.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
        });
        let positionReadBuffer = this.device.createBuffer({
            size: nodeLength * 4 * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        iterationCount = 2000;
        let numIterations = 0;
        // const querySet = this.device.createQuerySet({
        //     type: "timestamp",
        //     count: 10,
        // });
        // const queryBuffer = this.device.createBuffer({
        //     size: 8,
        //     usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
        // });
        // const readQueryBuffer = this.device.createBuffer({
        //     size: 8,
        //     usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        // });
        while (iterationCount > 0 && this.coolingFactor > 0.0001 && this.force >= 0) {
            numIterations++;
            iterationCount--;
            // Set up params (node length, edge length)
            const upload = this.device.createBuffer({
                size: 4 * 4,
                usage: GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true,
            });
            const mapping = upload.getMappedRange();
            new Uint32Array(mapping).set([nodeLength, edgeLength]);
            new Float32Array(mapping).set([this.coolingFactor, l], 2);
            upload.unmap();
            //this.device.createQuerySet({})
            let commandEncoder = this.device.createCommandEncoder();
            //commandEncoder.writeTimestamp();
            commandEncoder.copyBufferToBuffer(upload, 0, this.paramsBuffer, 0, 4 * 4);
            // commandEncoder.copyBufferToBuffer(clearBuffer, 0, this.quadTreeBuffer, 0, quadTreeLength);
            this.device.queue.submit([commandEncoder.finish()]);
            commandEncoder = this.device.createCommandEncoder();
            // Run create quadtree pass
            let computePassEncoder = commandEncoder.beginComputePass();
            computePassEncoder.setBindGroup(0, quadTreeBindGroup);
            computePassEncoder.setPipeline(this.createQuadTreePipeline);
            computePassEncoder.dispatchWorkgroups(1, 1, 1);
            computePassEncoder.end();
            // commandEncoder.writeTimestamp(querySet, 0);
            // commandEncoder.resolveQuerySet(querySet, 0, 1, queryBuffer, 0);
            // commandEncoder.copyBufferToBuffer(
            //     queryBuffer /* source buffer */ ,
            //     0 /* source offset */ ,
            //     readQueryBuffer /* destination buffer */ ,
            //     0 /* destination offset */ ,
            //     8 /* size */
            // );           
            this.device.queue.submit([commandEncoder.finish()]);

            // await readQueryBuffer.mapAsync(GPUMapMode.READ);
            // let queryArray = readQueryBuffer.getMappedRange();
            // let output = new Float32Array(queryArray); 
            // console.log(output);

            commandEncoder = this.device.createCommandEncoder();
            // this.device.queue.submit([commandEncoder.finish()]);
            // const start : number = performance.now();
            // await this.device.queue.onSubmittedWorkDone();
            // const end : number = performance.now();
            // console.log(`quad time: ${end - start}`);
            // const commandEncoder = this.device.createCommandEncoder();

            const stackBuffer = this.device.createBuffer({
                size: nodeLength * 1000 * 4,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
            });
            // Create BH bindgroup
            const bindGroup = this.device.createBindGroup({
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
                            buffer: this.quadTreeBuffer,
                        },
                    },
                    {
                        binding: 4,
                        resource: {
                            buffer: stackBuffer,
                        },
                    },
                    {
                        binding: 5,
                        resource: {
                            buffer: batchBuffer
                        }
                    }
                ],
            });

            // Run attract forces pass
            const attractBindGroup = this.device.createBindGroup({
                layout: this.computeAttractiveNewPipeline.getBindGroupLayout(0),
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

            // Run attract forces pass
            computePassEncoder = commandEncoder.beginComputePass();
            computePassEncoder.setBindGroup(0, attractBindGroup);
            computePassEncoder.setPipeline(this.computeAttractiveNewPipeline);
            computePassEncoder.dispatchWorkgroups(nodeLength, 1, 1);
            computePassEncoder.end();

            // this.device.queue.submit([commandEncoder.finish()]);
            // const start : number = performance.now();
            // await this.device.queue.onSubmittedWorkDone();
            // const end : number = performance.now();
            // console.log(`attract force time: ${end - start}`)
            // const commandEncoder = this.device.createCommandEncoder();

            // Run compute forces pass
            // const pass = commandEncoder.beginComputePass();
            // pass.setBindGroup(0, bindGroup);
            // pass.setPipeline(this.computeForcesPipeline);
            // pass.dispatchWorkgroups(nodeLength, 1, 1);
            // pass.end();

            // Run compute forces BH pass
            for (let i = 0; i < 1; i++) {
                const upload = this.device.createBuffer({
                    size: 4,
                    usage: GPUBufferUsage.COPY_SRC,
                    mappedAtCreation: true,
                });
                const mapping = upload.getMappedRange();
                new Uint32Array(mapping).set([i]);
                upload.unmap();
                commandEncoder.copyBufferToBuffer(upload, 0, batchBuffer, 0, 4);
                const pass = commandEncoder.beginComputePass();
                pass.setBindGroup(0, bindGroup);
                pass.setPipeline(this.computeForcesBHPipeline);
                pass.dispatchWorkgroups(Math.ceil(nodeLength / 1), 1, 1);
                pass.end();
                this.device.queue.submit([commandEncoder.finish()]);
                // await this.device.queue.onSubmittedWorkDone();
                commandEncoder = this.device.createCommandEncoder();
            }
            // const pass = commandEncoder.beginComputePass();
            // pass.setBindGroup(0, bindGroup);
            // pass.setPipeline(this.computeForcesBHPipeline);
            // pass.dispatchWorkgroups(nodeLength, 1, 1);
            // pass.end();

            // Testing timing of both passes (comment out when not debugging)
            // pass.end();
            // this.device.queue.submit([commandEncoder.finish()]);
            // const start : number = performance.now();
            // await this.device.queue.onSubmittedWorkDone();
            // const end : number = performance.now();
            // console.log(`compute force time: ${end - start}`)
            // const commandEncoder = this.device.createCommandEncoder();

            const gpuReadBuffer = this.device.createBuffer({
                size: 4 * 4,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
            const gpuReadBuffer3 = this.device.createBuffer({
                size: nodeLength * 2 * 4,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
            // const gpuReadBuffer2 = this.device.createBuffer({
            //     size: nodeLength * 200 * 4,
            //     usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            // });
            // Encode commands for copying buffer to buffer.
            commandEncoder.copyBufferToBuffer(
                this.forceDataBuffer /* source buffer */,
                0 /* source offset */,
                gpuReadBuffer3 /* destination buffer */,
                0 /* destination offset */,
                nodeLength * 2 * 4 /* size */
            );
            // Encode commands for copying buffer to buffer.
            // commandEncoder.copyBufferToBuffer(
            //     stackBuffer /* source buffer */ ,
            //     0 /* source offset */ ,
            //     gpuReadBuffer2 /* destination buffer */ ,
            //     0 /* destination offset */ ,
            //     nodeLength * 200 * 4 /* size */
            // );
            commandEncoder.copyBufferToBuffer(bounding, 0, rangeBuffer, 0, 4 * 4);

            computePassEncoder = commandEncoder.beginComputePass();
            //commandEncoder.writeTimestamp();


            // Run apply forces pass
            computePassEncoder.setBindGroup(0, applyBindGroup);
            computePassEncoder.setPipeline(this.applyForcesPipeline);
            computePassEncoder.dispatchWorkgroups(Math.ceil(nodeLength / 2), 1, 1);
            computePassEncoder.end();

            commandEncoder.copyBufferToBuffer(
                rangeBuffer /* source buffer */,
                0 /* source offset */,
                gpuReadBuffer /* destination buffer */,
                0 /* destination offset */,
                4 * 4 /* size */
            );

            commandEncoder.copyBufferToBuffer(
                this.nodeDataBuffer,
                0,
                positionReadBuffer,
                0,
                nodeLength * 4 * 4
            );

            this.device.queue.submit([commandEncoder.finish()]);
            const start: number = performance.now();
            await this.device.queue.onSubmittedWorkDone();
            const end: number = performance.now();
            console.log(`iteration time ${end - start}`)
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
            stackBuffer.destroy();
            this.coolingFactor = this.coolingFactor * coolingFactor;

        }
        await positionReadBuffer.mapAsync(GPUMapMode.READ);
        // let positionArrayBuffer = positionReadBuffer.getMappedRange();
        // let positionList = new Float32Array(positionArrayBuffer);
        await this.device.queue.onSubmittedWorkDone();

        const totalEnd = performance.now();
        // const iterAvg : number = iterationTimes.reduce(function(a, b) {return a + b}) / iterationTimes.length;
        const iterAvg = (totalEnd - totalStart) / numIterations;
        iterRef.current!.innerText = `Completed in ${numIterations} iterations with total time ${totalEnd - totalStart} and average iteration time ${iterAvg}`;
        // let d3Format = this.formatToD3Format(
        //     positionList,
        //     edgeList,
        //     nodeLength,
        //     edgeLength
        //   );
        // let formattedNodeList = d3Format.nodeArray;
        // let formattedEdgeList = d3Format.edgeArray;

        // console.log(formattedNodeList, formattedEdgeList);
        // const element = document.createElement("a");
        // const textFile = new Blob([JSON.stringify(formattedEdgeList)], {type: 'application/json'});
        // element.href = URL.createObjectURL(textFile);
        // element.download = "BH_edges.json";
        // document.body.appendChild(element); 
        // element.click();
        // const element2 = document.createElement("a");
        // const textFile2 = new Blob([JSON.stringify(formattedNodeList)], {type: 'application/json'});
        // element.href = URL.createObjectURL(textFile2);
        // element.download = "BH_nodes.json";
        // document.body.appendChild(element2); 
        // element.click();


        requestAnimationFrame(frame);
    }
}
