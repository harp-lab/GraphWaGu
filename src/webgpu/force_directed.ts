import { buffer } from 'd3';
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
import * as fs from 'fs';

class ForceDirected {
    public paramsBuffer: GPUBuffer;
    public nodeDataBuffer: GPUBuffer;
    public edgeDataBuffer: GPUBuffer;
    public adjMatrixBuffer: GPUBuffer;
    public laplacianBuffer: GPUBuffer;
    public quadTreeBuffer: GPUBuffer;
    public forceDataBuffer: GPUBuffer;
    public coolingFactor: number = 0.985;
    public device: GPUDevice;
    public createMatrixPipeline : GPUComputePipeline;
    public createQuadTreePipeline : GPUComputePipeline;
    public createSourceListPipeline : GPUComputePipeline;
    public createTargetListPipeline : GPUComputePipeline;
    public computeAttractiveNewPipeline : GPUComputePipeline;
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
            compute: {
                module: device.createShaderModule({
                    code: create_adjacency_matrix
                }),
                entryPoint: "main",
            },
        });

        this.createQuadTreePipeline = device.createComputePipeline({
            compute: {
                module: device.createShaderModule({
                    code: create_quadtree
                }),
                entryPoint: "main",
            },
        });

        this.createSourceListPipeline = device.createComputePipeline({
            compute: {
                module: device.createShaderModule({
                    code: create_sourcelist
                }),
                entryPoint: "main",
            },
        });

        this.createTargetListPipeline = device.createComputePipeline({
            compute: {
                module: device.createShaderModule({
                    code: create_targetlist
                }),
                entryPoint: "main",
            },
        });

        this.computeAttractiveNewPipeline = device.createComputePipeline({
            compute: {
                module: device.createShaderModule({
                    code: compute_attractive_new
                }),
                entryPoint: "main",
            },
        });

        this.computeForcesPipeline = device.createComputePipeline({
            compute: {
                module: device.createShaderModule({
                    code: compute_forces,
                }),
                entryPoint: "main",
            },
        });

        this.computeForcesBHPipeline = device.createComputePipeline({
            compute: {
                module: device.createShaderModule({
                    code: compute_forcesBH,
                }),
                entryPoint: "main",
            },
        });

        this.computeAttractForcesPipeline = device.createComputePipeline({
            compute: {
                module: device.createShaderModule({
                    code: compute_attract_forces,
                }),
                entryPoint: "main",
            },
        });

        this.applyForcesPipeline = device.createComputePipeline({
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

    formatToD3Format(positionList, edgeList, nLength, eLength) {
        let nodeArray1 = new Array(nLength);
        let edgeArray1 = new Array(eLength / 2);
    
        for (let i = 0; i < 4 * nLength; i = i + 4) {
          nodeArray1[i / 4] = {};
          nodeArray1[i / 4].index = i / 4;
          nodeArray1[i / 4].name = (i / 4).toString();
          nodeArray1[i / 4].x = positionList[i + 1];
          nodeArray1[i / 4].y = positionList[i + 2];
        }
    
        for (let i = 0; i < eLength; i = i + 2) {
          edgeArray1[i / 2] = {};
          let sourceIndex = edgeList[i];
          let targetIndex = edgeList[i + 1];
    
          edgeArray1[i / 2].index = i / 2;
          edgeArray1[i / 2].source = {};
          edgeArray1[i / 2].source.index = sourceIndex;
          edgeArray1[i / 2].source.name = sourceIndex.toString();
          edgeArray1[i / 2].source.x = nodeArray1[sourceIndex].x;
          edgeArray1[i / 2].source.y = nodeArray1[sourceIndex].y;
    
          edgeArray1[i / 2].target = {};
          edgeArray1[i / 2].target.index = targetIndex;
          edgeArray1[i / 2].target.name = targetIndex.toString();
          edgeArray1[i / 2].target.x = nodeArray1[targetIndex].x;
          edgeArray1[i / 2].target.y = nodeArray1[targetIndex].y;
        }
    
        return {
          nodeArray: nodeArray1,
          edgeArray: edgeArray1,
        };
      }

    async runForces(
        nodeDataBuffer = this.nodeDataBuffer, 
        edgeDataBuffer = this.edgeDataBuffer, 
        nodeLength: number = 0, edgeLength: number = 0, 
        coolingFactor = this.coolingFactor, l = 0.01, 
        iterationCount = this.iterationCount, 
        threshold = this.threshold,
        iterRef,
        sourceEdgeBuffer, targetEdgeBuffer, frame, edgeList
    ) {
        // coolingFactor = 0.995;
        // l = 0.01;
        if (nodeLength == 0 || edgeLength == 0) {
            return;
        }
        console.log(l);
        console.log(coolingFactor);
        this.coolingFactor = coolingFactor;
        this.nodeDataBuffer = nodeDataBuffer;
        this.edgeDataBuffer = edgeDataBuffer;
        this.threshold = threshold;
        this.force = 100000;
        const rangeBuffer = this.device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        var bounding = this.device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        var mapping = bounding.getMappedRange();
        new Int32Array(mapping).set([0, 1000, 0, 1000]);
        bounding.unmap();
        // this.coolingFactor = 2.0;
        var commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(bounding, 0, rangeBuffer, 0, 4 * 4);
        this.device.queue.submit([commandEncoder.finish()]);

        // Set up params (node length, edge length) for creating adjacency matrix
        var upload = this.device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        var mapping = upload.getMappedRange();
        new Uint32Array(mapping).set([nodeLength, edgeLength]);
        new Float32Array(mapping).set([this.coolingFactor, l], 2);
        upload.unmap();

        var commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(upload, 0, this.paramsBuffer, 0, 4 * 4);

        this.device.queue.submit([commandEncoder.finish()]);

        this.forceDataBuffer = this.device.createBuffer({
            size: nodeLength * 2 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        var quadTreeLength = nodeLength * 12 * 4 * 4;
        this.quadTreeBuffer = this.device.createBuffer({
            size: quadTreeLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        var sourceListBuffer = this.device.createBuffer({
            size: edgeLength * 2,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        var targetListBuffer = this.device.createBuffer({
            size: edgeLength * 2,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        var edgeInfoBuffer = this.device.createBuffer({
            size: nodeLength * 4 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        var createSourceListBindGroup = this.device.createBindGroup({
            layout: this.createSourceListPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: sourceEdgeBuffer,
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
        var createTargetListBindGroup = this.device.createBindGroup({
            layout: this.createTargetListPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: targetEdgeBuffer,
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
        });
        this.device.queue.submit([commandEncoder.finish()]);
        var commandEncoder = this.device.createCommandEncoder();
        // Run create source and target lists pass
        var pass = commandEncoder.beginComputePass();
        pass.setBindGroup(0, createSourceListBindGroup);
        pass.setPipeline(this.createSourceListPipeline);
        pass.dispatch(1, 1, 1);
        pass.setBindGroup(0, createTargetListBindGroup);
        pass.setPipeline(this.createTargetListPipeline);
        pass.dispatch(1, 1, 1);
        pass.endPass();
        const gpuReadBuffer = this.device.createBuffer({
            size: nodeLength * 4 * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        commandEncoder.copyBufferToBuffer(
            edgeInfoBuffer /* source buffer */ ,
            0 /* source offset */ ,
            gpuReadBuffer /* destination buffer */ ,
            0 /* destination offset */ ,
            nodeLength * 4 * 4 /* size */
        );
        this.device.queue.submit([commandEncoder.finish()]);
        // await this.device.queue.onSubmittedWorkDone();
        // await gpuReadBuffer.mapAsync(GPUMapMode.READ);
        // const arrayBuffer = gpuReadBuffer.getMappedRange();
        // var list = new Uint32Array(arrayBuffer);
        // console.log(list);
        // return;

        var iterationTimes : Array<number> = [];
        var totalStart = performance.now();
        var applyBindGroup = this.device.createBindGroup({
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
        var quadTreeBindGroup = this.device.createBindGroup({
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
        var batchBuffer = this.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
        });
        let positionReadBuffer = this.device.createBuffer({
            size: nodeLength * 4 * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        iterationCount = 2000;
        var numIterations = 0;
        // var querySet = this.device.createQuerySet({
        //     type: "timestamp",
        //     count: 10,
        // });
        // var queryBuffer = this.device.createBuffer({
        //     size: 8,
        //     usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
        // });
        // var readQueryBuffer = this.device.createBuffer({
        //     size: 8,
        //     usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        // });
        while (iterationCount > 0 && this.coolingFactor > 0.0001 && this.force >= 0) {
            numIterations++;
            iterationCount--;
            // Set up params (node length, edge length)
            var upload = this.device.createBuffer({
                size: 4 * 4,
                usage: GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true,
            });
            var mapping = upload.getMappedRange();
            new Uint32Array(mapping).set([nodeLength, edgeLength]);
            new Float32Array(mapping).set([this.coolingFactor, l], 2);
            upload.unmap();
            //this.device.createQuerySet({})
            var commandEncoder = this.device.createCommandEncoder();
            //commandEncoder.writeTimestamp();
            commandEncoder.copyBufferToBuffer(upload, 0, this.paramsBuffer, 0, 4 * 4);
            // commandEncoder.copyBufferToBuffer(clearBuffer, 0, this.quadTreeBuffer, 0, quadTreeLength);
            this.device.queue.submit([commandEncoder.finish()]);
            var commandEncoder = this.device.createCommandEncoder();
            // Run create quadtree pass
            var pass = commandEncoder.beginComputePass();
            pass.setBindGroup(0, quadTreeBindGroup);
            pass.setPipeline(this.createQuadTreePipeline);
            pass.dispatch(1, 1, 1);
            pass.endPass();
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

            var commandEncoder = this.device.createCommandEncoder();
            // this.device.queue.submit([commandEncoder.finish()]);
            // var start : number = performance.now();
            // await this.device.queue.onSubmittedWorkDone();
            // var end : number = performance.now();
            // console.log(`quad time: ${end - start}`);
            // var commandEncoder = this.device.createCommandEncoder();

            var stackBuffer = this.device.createBuffer({
                size: nodeLength * 1000 * 4,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
            });
            // Create BH bindgroup
            var bindGroup = this.device.createBindGroup({
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
            var attractBindGroup = this.device.createBindGroup({
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
            var pass = commandEncoder.beginComputePass();
            pass.setBindGroup(0, attractBindGroup);
            pass.setPipeline(this.computeAttractiveNewPipeline);
            pass.dispatch(nodeLength, 1, 1);      
            pass.endPass();

            // this.device.queue.submit([commandEncoder.finish()]);
            // var start : number = performance.now();
            // await this.device.queue.onSubmittedWorkDone();
            // var end : number = performance.now();
            // console.log(`attract force time: ${end - start}`)
            // var commandEncoder = this.device.createCommandEncoder();

            // Run compute forces pass
            // var pass = commandEncoder.beginComputePass();
            // pass.setBindGroup(0, bindGroup);
            // pass.setPipeline(this.computeForcesPipeline);
            // pass.dispatch(nodeLength, 1, 1);
            // pass.endPass();

            // Run compute forces BH pass
            for (var i = 0; i < 1; i++) {
                var upload = this.device.createBuffer({
                    size: 4,
                    usage: GPUBufferUsage.COPY_SRC,
                    mappedAtCreation: true,
                });
                var mapping = upload.getMappedRange();
                new Uint32Array(mapping).set([i]);
                upload.unmap();
                commandEncoder.copyBufferToBuffer(upload, 0, batchBuffer, 0, 4);
                var pass = commandEncoder.beginComputePass();
                pass.setBindGroup(0, bindGroup);
                pass.setPipeline(this.computeForcesBHPipeline);
                pass.dispatch(Math.ceil(nodeLength / 1), 1, 1);
                pass.endPass();
                this.device.queue.submit([commandEncoder.finish()]);
                // await this.device.queue.onSubmittedWorkDone();
                var commandEncoder = this.device.createCommandEncoder();
            }
            // var pass = commandEncoder.beginComputePass();
            // pass.setBindGroup(0, bindGroup);
            // pass.setPipeline(this.computeForcesBHPipeline);
            // pass.dispatch(nodeLength, 1, 1);
            // pass.endPass();

            // Testing timing of both passes (comment out when not debugging)
            // pass.endPass();
            // this.device.queue.submit([commandEncoder.finish()]);
            // var start : number = performance.now();
            // await this.device.queue.onSubmittedWorkDone();
            // var end : number = performance.now();
            // console.log(`compute force time: ${end - start}`)
            // var commandEncoder = this.device.createCommandEncoder();

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
                this.forceDataBuffer /* source buffer */ ,
                0 /* source offset */ ,
                gpuReadBuffer3 /* destination buffer */ ,
                0 /* destination offset */ ,
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

            var pass = commandEncoder.beginComputePass();
            //commandEncoder.writeTimestamp();


            // Run apply forces pass
            pass.setBindGroup(0, applyBindGroup);
            pass.setPipeline(this.applyForcesPipeline);
            pass.dispatch(Math.ceil(nodeLength / 2), 1, 1);
            pass.endPass();

            commandEncoder.copyBufferToBuffer(
                rangeBuffer /* source buffer */ ,
                0 /* source offset */ ,
                gpuReadBuffer /* destination buffer */ ,
                0 /* destination offset */ ,
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
            var start : number = performance.now();
            await this.device.queue.onSubmittedWorkDone();
            var end : number = performance.now();
            console.log(`iteration time ${end - start}`)
            // iterationTimes.push(end - start);

            // this.maxForceResultBuffer.unmap();
            // Read all of the forces applied.
            // await gpuReadBuffer.mapAsync(GPUMapMode.READ);
            // const arrayBuffer = gpuReadBuffer.getMappedRange();
            // var output = new Int32Array(arrayBuffer);
            // console.log(output);

            // console.log(output[23]);
            // await gpuReadBuffer3.mapAsync(GPUMapMode.READ);
            // const arrayBuffer3 = gpuReadBuffer3.getMappedRange();
            // var output3 = new Float32Array(arrayBuffer3);
            // console.log(output3);
            // await gpuReadBuffer2.mapAsync(GPUMapMode.READ);
            // const arrayBuffer2 = gpuReadBuffer2.getMappedRange();
            // var output2 = new Uint32Array(arrayBuffer2);
            // console.log(output2);
            // for (var m = 0; m < output.length; m += 12) {
            //     var mass = output[m + 10];
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
        let positionArrayBuffer = positionReadBuffer.getMappedRange();
        let positionList = new Float32Array(positionArrayBuffer);
        await this.device.queue.onSubmittedWorkDone();

        var totalEnd = performance.now();
        // var iterAvg : number = iterationTimes.reduce(function(a, b) {return a + b}) / iterationTimes.length;
        var iterAvg = (totalEnd - totalStart) / numIterations;
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

export default ForceDirected;