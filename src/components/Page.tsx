import React from 'react';
import Sidebar from './Sidebar';
import { createRef, MutableRefObject } from 'react';
import Renderer from "../webgpu/render";
import { Form } from 'react-bootstrap';

type PageState = {
    canvasRef: MutableRefObject<HTMLCanvasElement | null>,
    outCanvasRef: MutableRefObject<HTMLCanvasElement | null>,
    iterRef: MutableRefObject<HTMLLabelElement | null>,
    renderer: Renderer | null,
}
class Page extends React.Component<{}, PageState> {
    constructor(props) {
        super(props);
        this.state = {
            canvasRef: createRef<HTMLCanvasElement | null>(), 
            outCanvasRef: createRef<HTMLCanvasElement | null>(), 
            iterRef: createRef<HTMLLabelElement | null>(),
            renderer: null
        };
    }

    async componentDidMount() {
        if (!navigator.gpu) {
            alert("GraphWaGu requires WebGPU, which is not currently enabled. You may be using an incompatible web browser or hardware, or have this feature disabled. If you are using Chrome, enable the setting at chrome://flags/#enable-unsafe-webgpu. If you are using Safari, first enable the Developer Menu (Preferences > Advanced), then check Develop > Experimental Features > WebGPU.");      
            return;
        }
        const adapter = (await navigator.gpu.requestAdapter({
            powerPreference: "high-performance",
        }))!;
        console.log(adapter);
        const device = await adapter.requestDevice({
            requiredFeatures: [
                "timestamp-query" as GPUFeatureName,
            ],
            requiredLimits: {
                "maxStorageBufferBindingSize": adapter.limits.maxStorageBufferBindingSize,
                "maxComputeWorkgroupsPerDimension": adapter.limits.maxComputeWorkgroupsPerDimension
            }
        }); 
        console.log(device);
        this.setState({renderer: new Renderer(
            adapter, device, this.state.canvasRef, 
            this.state.outCanvasRef, this.state.iterRef)
        });
    }

    setNodeEdgeData(nodeData : Array<number>, edgeData : Array<number>, sourceEdges : Array<number>, targetEdges : Array<number>) {
        this.state.renderer!.setNodeEdgeData(nodeData, edgeData, sourceEdges, targetEdges);
    }

    setIdealLength(value : number) {
        this.state.renderer!.setIdealLength(value);
    }

    setCoolingFactor(value : number) {
        this.state.renderer!.setCoolingFactor(value);
    }

    toggleNodeLayer() {
        this.state.renderer!.toggleNodeLayer();
    }

    toggleEdgeLayer() {
        this.state.renderer!.toggleEdgeLayer();
    }

    runForceDirected() {
        this.state.renderer!.runForceDirected();
    }
  
    render() {
      return (
        <div>
            <Sidebar 
                setNodeEdgeData={this.setNodeEdgeData.bind(this)} 
                setIdealLength={this.setIdealLength.bind(this)}
                setCoolingFactor={this.setCoolingFactor.bind(this)}
                toggleNodeLayer={this.toggleNodeLayer.bind(this)}
                toggleEdgeLayer={this.toggleEdgeLayer.bind(this)}
                runForceDirected={this.runForceDirected.bind(this)}
            />
            <div className="canvasContainer">
                <Form.Label className="h1 header">GraphWaGu</Form.Label>
                <br/>
                <Form.Label className={"out"} ref={this.state.iterRef} ></Form.Label>
                <canvas ref={this.state.canvasRef} width={800} height={800}></canvas>
                <canvas hidden={true} ref={this.state.outCanvasRef} width={800} height={800}></canvas>
            </div>
        </div>
      );
    }
  }

export default Page;