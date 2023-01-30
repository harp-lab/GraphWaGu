import { Controller } from './ez_canvas_controller';
import { node_vert, node_frag, edge_vert, edge_frag } from './wgsl';
import { ForceDirected } from './force_directed';

class Renderer {
  public uniform2DBuffer : GPUBuffer | null = null;
  public forceDirected : ForceDirected | null = null;
  public device : GPUDevice;
  public nodeBindGroup : GPUBindGroup | null = null;
  public edgeBindGroup : GPUBindGroup | null = null;
  public nodeDataBuffer : GPUBuffer | null = null;
  public edgeDataBuffer : GPUBuffer | null = null;
  public sourceEdgeDataBuffer : GPUBuffer | null = null;
  public targetEdgeDataBuffer : GPUBuffer | null = null;
  public viewBoxBuffer : GPUBuffer | null = null;
  public nodePipeline : GPURenderPipeline | null = null;
  public edgePipeline : GPURenderPipeline | null = null;
  public nodeLength : number = 1;
  public edgeLength : number = 1;
  public nodeToggle : boolean = true;
  public edgeToggle : boolean = true;
  public outCanvasRef : React.RefObject<HTMLCanvasElement>;
  public canvasSize : [number, number] | null = null;
  public idealLength : number = 0.01;
  public coolingFactor : number = 0.985;
  public iterRef : React.RefObject<HTMLLabelElement>;
  public frame : (() => void) | undefined;
  public edgeList : Array<number> = [];

  constructor(
    adapter : GPUAdapter, device : GPUDevice, 
    canvasRef : React.RefObject<HTMLCanvasElement>, 
    outCanvasRef : React.RefObject<HTMLCanvasElement>, 
    iterRef : React.RefObject<HTMLLabelElement>,
  ) {
    this.iterRef = iterRef;
    this.outCanvasRef = outCanvasRef
    this.device = device;
    // Check that canvas is active
    if (canvasRef.current === null) return;
    const context = canvasRef.current.getContext('webgpu')!;
  
    const devicePixelRatio = window.devicePixelRatio || 1;
    const presentationSize = [
      canvasRef.current.clientWidth * devicePixelRatio,
      canvasRef.current.clientHeight * devicePixelRatio,
    ];
    const presentationFormat: GPUTextureFormat = 'bgra8unorm';
    this.canvasSize = [
      canvasRef.current.width,
      canvasRef.current.height
    ];
  
    context.configure({
      device,
      format: presentationFormat,
      size: presentationSize,
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
        buffers:[
          {
            arrayStride: 2 * 4 * 1,
            attributes:[{
              format:"float32x2" as GPUVertexFormat,
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
              color: {srcFactor: "one" as GPUBlendFactor, dstFactor: "one-minus-src-alpha" as GPUBlendFactor},
              alpha: {srcFactor: "one" as GPUBlendFactor, dstFactor: "one-minus-src-alpha" as GPUBlendFactor}
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

    const nodePositionBuffer = device.createBuffer({
      size: 6 * 2 * 4,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(nodePositionBuffer.getMappedRange()).set([
      1, -1,
      -1, -1,
      -1, 1,
      1, -1,
      -1, 1,
      1, 1,
    ]);
    nodePositionBuffer.unmap();
    const edgePositionBuffer = device.createBuffer({
      size: 2 * 2 * 4,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(edgePositionBuffer.getMappedRange()).set([
      0, 0,
      1, 1,
    ]);
    edgePositionBuffer.unmap();

    this.nodeDataBuffer = device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true
    });
    new Float32Array(this.nodeDataBuffer.getMappedRange()).set([
      0.5, 0.5,
      0.5, 0.5,
    ]);
    this.nodeDataBuffer.unmap();

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
              color: {srcFactor: "one" as GPUBlendFactor, dstFactor: "one-minus-src-alpha" as GPUBlendFactor},
              alpha: {srcFactor: "one" as GPUBlendFactor, dstFactor: "one-minus-src-alpha" as GPUBlendFactor}
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
    device.queue.writeBuffer(this.viewBoxBuffer, 0, new Float32Array([0, 0, 1, 1]), 0, 4);
    let translation = [0, 0, 1, 1];
    let newTranslation = [0, 0, 1, 1];
    const controller = new Controller();
    const render = this;
    controller.mousemove = function (prev, cur, evt) {
      if (evt.buttons === 1) {
        const change = [(cur[0] - prev[0]) * (translation[2] - translation[0]) / render.canvasSize![0], (prev[1] - cur[1]) * (translation[3] - translation[1]) / render.canvasSize![1]];
        newTranslation = [newTranslation[0] - change[0], newTranslation[1] - change[1], newTranslation[2] - change[0], newTranslation[3] - change[1]]
        if (Math.abs(newTranslation[0] - translation[0]) > 0.03 * (translation[2] - translation[0]) || Math.abs(newTranslation[1] - translation[1]) > 0.03 * (translation[3] - translation[1])) {
          translation = newTranslation;
          device.queue.writeBuffer(render.viewBoxBuffer!, 0, new Float32Array(translation), 0, 4);
        }
      }
    };
    controller.wheel = function (amt) {
      const change = [amt / 1000, amt / 1000];
      newTranslation = [newTranslation[0] + change[0], newTranslation[1] + change[1], newTranslation[2] - change[0], newTranslation[3] - change[1]];
      if (newTranslation[2] - newTranslation[0] > 0.01 && newTranslation[3] - newTranslation[1] > 0.01) {
        translation = newTranslation;
        device.queue.writeBuffer(render.viewBoxBuffer!, 0, new Float32Array(translation), 0, 4);
      } else {
        newTranslation = translation;
      }
    };
    controller.registerForCanvas(canvasRef.current);
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
      size: presentationSize,
      sampleCount: 4,
      format: presentationFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const view = texture.createView();

    this.frame = async function frame() {
        // const start = performance.now();
        // Sample is no longer the active page.
        if (!canvasRef.current) return;

        const commandEncoder = device.createCommandEncoder();

        const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          {
            view,
            resolveTarget: context.getCurrentTexture().createView(),
            loadOp: 'clear' as GPULoadOp,
            clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
            storeOp: "discard" as GPUStoreOp,
          },
        ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        if (render.edgeToggle) {
          passEncoder.setPipeline(render.edgePipeline!);
          passEncoder.setVertexBuffer(0, edgePositionBuffer);
          passEncoder.setBindGroup(0, render.edgeBindGroup!);
          passEncoder.draw(2, render.edgeLength / 2, 0, 0);
        }
        if (render.nodeToggle) {
          passEncoder.setPipeline(render.nodePipeline!);
          passEncoder.setVertexBuffer(0, nodePositionBuffer);
          passEncoder.setBindGroup(0, render.nodeBindGroup!);
          passEncoder.draw(6, render.nodeLength, 0, 0);
        }
        passEncoder.end();
  
        device.queue.submit([commandEncoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        // const end = performance.now();
        requestAnimationFrame(frame);
    }

    this.frame();

  }

  setNodeEdgeData(nodeData : Array<number>, edgeData : Array<number>, sourceEdges : Array<number>, targetEdges : Array<number>) {
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
        }
      ],
    });
    this.edgeLength = edgeData.length;
    console.log(this.edgeLength);
    this.nodeLength = nodeData.length / 4;
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
  }

  setCoolingFactor(value : number) {
    this.coolingFactor = value;
  }

  setIdealLength(value : number) {
    this.idealLength = value;
  }

  async runForceDirected() {
    this.forceDirected!.runForces(
      this.nodeDataBuffer!, this.edgeDataBuffer!, this.nodeLength, this.edgeLength, 
      this.coolingFactor, this.idealLength, 10000, 100, this.iterRef,
      this.sourceEdgeDataBuffer, this.targetEdgeDataBuffer, this.frame!, this.edgeList
    );
  }

  toggleNodeLayer() {
    this.nodeToggle = !this.nodeToggle;
  }

  toggleEdgeLayer() {
    this.edgeToggle = !this.edgeToggle;
  }
}
export default Renderer;

