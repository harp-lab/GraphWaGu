import {node_vert} from './wgsl-shaders';
import {node_frag} from './wgsl-shaders';
import {edge_vert} from './wgsl-shaders';
import {edge_frag} from './wgsl-shaders';
import { Controller } from './ez_canvas_controller';
import { ForceDirected } from './force_directed';
import { getBuffer } from './utils';
import { saveAs } from 'file-saver';

class Renderer {
  public device: GPUDevice;
  public forceDirected: ForceDirected | null = null;

  public nodeBindGroup: GPUBindGroup | null = null;
  public edgeBindGroup: GPUBindGroup | null = null;
  public uniform2DBuffer: GPUBuffer | null = null;
  public nodeDataBuffer: GPUBuffer | null = null;
  public edgeDataBuffer: GPUBuffer | null = null;
  public sourceEdgeDataBuffer: GPUBuffer | null = null;
  public targetEdgeDataBuffer: GPUBuffer | null = null;
  public viewBoxBuffer: GPUBuffer | null = null;
  public nodePipeline: GPURenderPipeline | null = null;
  public edgePipeline: GPURenderPipeline | null = null;

  public nodeLength: number = 1;
  public edgeLength: number = 1;
  public nodeToggle: boolean = true;
  public edgeToggle: boolean = true;
  public canvasSize: [number, number] | null = null;
  public idealLength: number = 0.005;
  public coolingFactor: number = 0.985;
  public iterRef: React.RefObject<HTMLLabelElement>;
  public frame: (() => void) | undefined;
  public edgeList: Array<number> = [];
  public mortonCodeBuffer: GPUBuffer | null = null;
  public energy: number = 0.1;
  public theta: number = 2;
  canvasRef: any;
  viewExtreme: [number, number, number, number];
  iterationCount: number = 1000;
  context: GPUCanvasContext | null = null;
  edgePositionBuffer: GPUBuffer | null = null;
  nodePositionBuffer: GPUBuffer | null = null;

  constructor(
    device: GPUDevice,
    canvasRef: React.RefObject<HTMLCanvasElement>,
    iterRef: React.RefObject<HTMLLabelElement>,
  ) {
    this.iterRef = iterRef;
    this.device = device;
    this.canvasRef = canvasRef;
    this.viewExtreme = [-1, -1, 2, 2];
    // Check that canvas is active
    if (canvasRef.current === null) return;
    this.context = canvasRef.current.getContext('webgpu')!;

    const devicePixelRatio = window.devicePixelRatio || 1;
    
    canvasRef.current.width = 800 * devicePixelRatio;
    canvasRef.current.height = 800 * devicePixelRatio;
    // canvasRef.current.width = 3840;
    // canvasRef.current.height = 2160;
    const presentationFormat: GPUTextureFormat = 'rgba8unorm';
    this.canvasSize = [
      canvasRef.current.width,
      canvasRef.current.height
    ];

    this.context.configure({
      device,
      format: presentationFormat,
      alphaMode: 'opaque',
    });

    this.edgeDataBuffer = device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });

    let edgeData = [0, 0, 0.01, 0.01];
    new Float32Array(this.edgeDataBuffer.getMappedRange()).set(edgeData);
    this.edgeDataBuffer.unmap();

    // setting it to some trivial data so that it won't fail the pipeline before edge data is available

    this.edgePipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: device.createShaderModule({
          code: edge_vert
        }),
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 2 * 4 * 1,
            attributes: [{
              format: "float32x2" as GPUVertexFormat,
              offset: 0,
              shaderLocation: 0
            }
            ]
          }
        ]
      },
      fragment: {
        module: device.createShaderModule({
          code: edge_frag
        }),
        entryPoint: "main",
        targets: [
          {
            format: presentationFormat,
            blend: {
              color: { srcFactor: "one" as GPUBlendFactor, dstFactor: "one-minus-src-alpha" as GPUBlendFactor },
              alpha: { srcFactor: "one" as GPUBlendFactor, dstFactor: "one-minus-src-alpha" as GPUBlendFactor }
            },
          },
        ],
      },
      primitive: {
        topology: "line-list" //triangle-list is default   
      },
      multisample: {
        count: 4
      }
    });

    const nodePositionArray = new Float32Array([
      1, -1, -1, -1,
      -1, 1, 1, -1,
      -1, 1, 1, 1,
    ]);
    this.nodePositionBuffer = getBuffer(device, nodePositionArray, GPUBufferUsage.VERTEX);

    const edgePositionArray = new Float32Array([0, 0, 1, 1]);
    this.edgePositionBuffer = getBuffer(device, edgePositionArray, GPUBufferUsage.VERTEX);

    const nodeDataArray = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    this.nodeDataBuffer = getBuffer(device, nodeDataArray, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.mortonCodeBuffer = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true
    });
    let mortonCode = [0];
    new Float32Array(this.mortonCodeBuffer.getMappedRange()).set(mortonCode);
    this.mortonCodeBuffer.unmap();


    this.nodePipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: device.createShaderModule({
          code: node_vert,
        }),
        entryPoint: 'main',
        buffers: [
          {
            arrayStride: 2 * 4,
            attributes: [
              {
                format: "float32x2" as GPUVertexFormat,
                offset: 0,
                shaderLocation: 0,
              }
            ],
          },
        ],
      },
      fragment: {
        module: device.createShaderModule({
          code: node_frag,
        }),
        entryPoint: 'main',
        targets: [
          {
            format: presentationFormat,
            blend: {
              color: { srcFactor: "one" as GPUBlendFactor, dstFactor: "one-minus-src-alpha" as GPUBlendFactor },
              alpha: { srcFactor: "one" as GPUBlendFactor, dstFactor: "one-minus-src-alpha" as GPUBlendFactor }
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      multisample: {
        count: 4
      }
    });

    this.forceDirected = new ForceDirected(device);

    this.viewBoxBuffer = device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.nodeBindGroup = device.createBindGroup({
      layout: this.nodePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.viewBoxBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.nodeDataBuffer,
          }
        },
        {
          binding: 2,
          resource: {
            buffer: this.mortonCodeBuffer,
          }
        }
      ],
    });
    this.edgeBindGroup = device.createBindGroup({
      layout: this.edgePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.viewBoxBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.nodeDataBuffer,
          }
        },
        {
          binding: 2,
          resource: {
            buffer: this.edgeDataBuffer,
          }
        }
      ],
    });


    const texture = device.createTexture({
      size: [canvasRef.current.width, canvasRef.current.height],
      sampleCount: 4,
      format: presentationFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const view = texture.createView();
    const renderer = this;
    this.frame = async () => {
      // const start = performance.now();
      // Sample is no longer the active page.
      if (!canvasRef.current) return;

      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          {
            view,
            resolveTarget: renderer.context!.getCurrentTexture().createView(),
            clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
            loadOp: 'clear' as GPULoadOp,
            storeOp: "discard" as GPUStoreOp,
          },
        ],
      };

      const commandEncoder = device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

      if (this.edgeToggle) {
        passEncoder.setPipeline(this.edgePipeline!);
        passEncoder.setVertexBuffer(0, renderer.edgePositionBuffer!);
        passEncoder.setBindGroup(0, this.edgeBindGroup!);
        passEncoder.draw(2, this.edgeLength / 2, 0, 0);
      }
      if (this.nodeToggle) {
        passEncoder.setPipeline(this.nodePipeline!);
        passEncoder.setVertexBuffer(0, renderer.nodePositionBuffer!);
        passEncoder.setBindGroup(0, this.nodeBindGroup!);
        passEncoder.draw(6, this.nodeLength, 0, 0);
      }
      passEncoder.end();

      device.queue.submit([commandEncoder.finish()]);
    //   {
    //     var dbgBuffer = this.device.createBuffer({
    //         size: this.mortonCodeBuffer!.size,
    //         usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    //     });

    //     let commandEncoder2 = device.createCommandEncoder();
    //     commandEncoder2.copyBufferToBuffer(this.mortonCodeBuffer!, 0, dbgBuffer, 0, dbgBuffer.size);
    //     this.device.queue.submit([commandEncoder2.finish()]);
    //     await this.device.queue.onSubmittedWorkDone();

    //     await dbgBuffer.mapAsync(GPUMapMode.READ);

    //     var debugValsf = new Uint32Array(dbgBuffer.getMappedRange());
    //     console.log(debugValsf);
    // }
      // requestAnimationFrame(this.frame!);
    }

    this.frame();
  }

  async takeScreenshot() {
    if (!this.canvasRef.current) return;

    // Get dimensions
    const width = this.canvasRef.current.width;
    const height = this.canvasRef.current.height;
    const bytesPerPixel = 4; // RGBA
    const bufferSize = width * height * bytesPerPixel;

    // Create output buffer
    const outputBuffer = this.device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // Create a texture for capturing the frame
    const captureTexture = this.device.createTexture({
        size: { width, height, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        sampleCount: 4
    });

    // Create a resolve texture for the screenshot
    const resolveTexture = this.device.createTexture({
      size: { width, height, depthOrArrayLayers: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });

    // Modify render pass to write to capture texture
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: captureTexture.createView(),
          resolveTarget: resolveTexture.createView(),
          clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
          loadOp: 'clear' as GPULoadOp,
          storeOp: "discard" as GPUStoreOp,
        },
      ],
    };

    // Create command encoder and render
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    // Draw edges
    if (this.edgeToggle) {
        passEncoder.setPipeline(this.edgePipeline!);
        passEncoder.setVertexBuffer(0, this.edgePositionBuffer);
        passEncoder.setBindGroup(0, this.edgeBindGroup!);
        passEncoder.draw(2, this.edgeLength / 2, 0, 0);
    }

    // Draw nodes
    if (this.nodeToggle) {
        passEncoder.setPipeline(this.nodePipeline!);
        passEncoder.setVertexBuffer(0, this.nodePositionBuffer);
        passEncoder.setBindGroup(0, this.nodeBindGroup!);
        passEncoder.draw(6, this.nodeLength, 0, 0);
    }

    passEncoder.end();

    // Copy texture to buffer
    commandEncoder.copyTextureToBuffer(
        {
            texture: resolveTexture,
            mipLevel: 0,
            origin: { x: 0, y: 0, z: 0 }
        },
        {
            buffer: outputBuffer,
            bytesPerRow: width * bytesPerPixel,
            rowsPerImage: height,
        },
        {
            width: width,
            height: height,
            depthOrArrayLayers: 1
        }
    );

    // Submit commands and wait for completion
    this.device.queue.submit([commandEncoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();

    // Map the buffer and read pixels
    await outputBuffer.mapAsync(GPUMapMode.READ);
    const pixelData = new Uint8Array(outputBuffer.getMappedRange());

    // Create canvas and draw pixels
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixelData);
    ctx.putImageData(imageData, 0, 0);

    canvas.toBlob(function (b) {
        saveAs(b!, `out.png`);
    }, "image/png");

    // Cleanup
    outputBuffer.unmap();
    captureTexture.destroy();
}

  setNodeEdgeData(nodeData: Array<number>, edgeData: Array<number>, sourceEdges: Array<number>, targetEdges: Array<number>) {
    // function randn_bm(mean, sigma) {
    //   const u = 0, v = 0;
    //   while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    //   while(v === 0) v = Math.random();
    //   const mag = sigma * Math.sqrt(-2.0 * Math.log(u));
    //   return mag * Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v ) + mean;
    // }
    // const N = 100000;
    // const clusters = 10;
    // const edgeData : Array<number> = [];
    // const nodeData : Array<number> = [];
    // for (const x = 0; x < N; x++) {
    //   nodeData.push(0.0, 0.0, 0.0, 1.0);
    // } 
    // for (const i = 0; i < clusters; i++){
    //   for (const j = 0; j < N * 2; j++) {
    //     const source = Math.floor(Math.random() * (N / clusters)) + i * (N / clusters);
    //     const target = Math.floor(Math.random() * (N / clusters)) + i * (N / clusters);
    //     if (!nodeData[source * 4 + 1]){
    //         nodeData[source * 4 + 1] = Math.random();
    //         nodeData[source * 4 + 2] = Math.random();
    //     }
    //     edgeData.push(source, target);
    //   }
    // }
    // console.log("nodes length" + nodeData.length / 4);
    // console.log("edges_length" + edgeData.length / 2);
    this.edgeList = edgeData;
    this.nodeDataBuffer = this.device.createBuffer({
      size: nodeData.length * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });
    new Float32Array(this.nodeDataBuffer.getMappedRange()).set(nodeData);
    this.nodeDataBuffer.unmap();
    this.mortonCodeBuffer = this.device.createBuffer({
      size: nodeData.length,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    this.edgeDataBuffer = this.device.createBuffer({
      size: edgeData.length * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
      mappedAtCreation: true
    });
    new Uint32Array(this.edgeDataBuffer.getMappedRange()).set(edgeData);
    this.edgeDataBuffer.unmap();
    this.edgeBindGroup = this.device.createBindGroup({
      layout: this.edgePipeline!.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.viewBoxBuffer!,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.nodeDataBuffer!,
          }
        },
        {
          binding: 2,
          resource: {
            buffer: this.edgeDataBuffer!,
          }
        }
      ],
    });
    this.nodeBindGroup = this.device.createBindGroup({
      layout: this.nodePipeline!.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.viewBoxBuffer!,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.nodeDataBuffer!,
          }
        },
        {
          binding: 2,
          resource: {
            buffer: this.mortonCodeBuffer!,
          }
        }
      ],
    });
    this.edgeLength = edgeData.length;
    this.nodeLength = nodeData.length / 4;
    this.viewExtreme = [Math.min(-1, -(this.nodeLength / 100000)), Math.min(-1, -(this.nodeLength / 100000)), Math.max(2, 2 * (this.nodeLength / 100000)), Math.max(2, 2 * (this.nodeLength / 100000))];
    this.device.queue.writeBuffer(this.viewBoxBuffer!, 0, new Float32Array(this.viewExtreme), 0, 4);
    this.setController();
    this.sourceEdgeDataBuffer = this.device.createBuffer({
      size: edgeData.length * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
      mappedAtCreation: true
    });
    new Uint32Array(this.sourceEdgeDataBuffer.getMappedRange()).set(sourceEdges);
    this.sourceEdgeDataBuffer.unmap();
    this.targetEdgeDataBuffer = this.device.createBuffer({
      size: edgeData.length * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
      mappedAtCreation: true
    });
    new Uint32Array(this.targetEdgeDataBuffer.getMappedRange()).set(targetEdges);
    this.targetEdgeDataBuffer.unmap();
    requestAnimationFrame(this.frame!);
  }

  setCoolingFactor(value: number) {
    this.coolingFactor = value;
  }

  setIdealLength(value: number) {
    this.idealLength = value;
  }

  setEnergy(value: number) {
    this.energy = value;
  }

  setIterationCount(value: number) {
    this.iterationCount = value;
  }

  setTheta(value: number) {
    this.theta = value;
  }

  async runForceDirected() {
    // this.forceDirected!.runForces(
    //   this.nodeDataBuffer!, this.edgeDataBuffer!, this.mortonCodeBuffer!, this.nodeLength, this.edgeLength,
    //   this.coolingFactor, this.idealLength, this.energy, this.theta, this.iterationCount, 100,
    //   this.sourceEdgeDataBuffer, this.targetEdgeDataBuffer, this.frame!
    // );
  }

  async stopForceDirected() {
    this.forceDirected!.stopForces();
  }

  toggleNodeLayer() {
    this.nodeToggle = !this.nodeToggle;
  }

  toggleEdgeLayer() {
    this.edgeToggle = !this.edgeToggle;
  }

  setController() {
    let translation = this.viewExtreme;
    let newTranslation = this.viewExtreme;
    const controller = new Controller();
    controller.mousemove = (prev, cur, evt) => {
      if (evt.buttons === 1) {
        const change = [(cur[0] - prev[0]) * (translation[2] - translation[0]) / this.canvasSize![0], (prev[1] - cur[1]) * (translation[3] - translation[1]) / this.canvasSize![1]];
        newTranslation = [newTranslation[0] - change[0], newTranslation[1] - change[1], newTranslation[2] - change[0], newTranslation[3] - change[1]]
        if (Math.abs(newTranslation[0] - translation[0]) > 0.03 * (translation[2] - translation[0]) || Math.abs(newTranslation[1] - translation[1]) > 0.03 * (translation[3] - translation[1])) {
          translation = newTranslation;
          this.device.queue.writeBuffer(this.viewBoxBuffer!, 0, new Float32Array(translation), 0, 4);
          requestAnimationFrame(this.frame!);
        }
      }
    };
    controller.wheel = (amt) => {
      const change = [amt / 1000, amt / 1000];
      newTranslation = [newTranslation[0] + change[0], newTranslation[1] + change[1], newTranslation[2] - change[0], newTranslation[3] - change[1]];
      if (newTranslation[2] - newTranslation[0] > 0.01 && newTranslation[3] - newTranslation[1] > 0.01) {
        translation = newTranslation;
        this.device.queue.writeBuffer(this.viewBoxBuffer!, 0, new Float32Array(translation), 0, 4);
        requestAnimationFrame(this.frame!);
      } else {
        newTranslation = translation;
      }
    };
    controller.registerForCanvas(this.canvasRef.current!);
  }
}
export default Renderer;

