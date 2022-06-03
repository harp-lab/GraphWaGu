import React from 'react';
import Sidebar from './Sidebar';
import Tutorial from './Tutorial';
import { createRef, MutableRefObject } from 'react';
import Renderer from "../webgpu/render";
import { Form } from 'react-bootstrap';

type PageState = {
    canvasRef: MutableRefObject<HTMLCanvasElement | null>,
    outCanvasRef: MutableRefObject<HTMLCanvasElement | null>,
    iterRef: MutableRefObject<HTMLLabelElement | null>,
    renderer: Renderer | null,
    renderTutorial: boolean,
}
class Page extends React.Component<{}, PageState> {
    constructor(props) {
        super(props);
        this.state = {
            canvasRef: createRef<HTMLCanvasElement | null>(), 
            outCanvasRef: createRef<HTMLCanvasElement | null>(), 
            iterRef: createRef<HTMLLabelElement | null>(),
            renderer: null, renderTutorial: true
        };
        this.unmountTutorial = this.unmountTutorial.bind(this);
    }

    async componentDidMount() {
        const adapter = (await navigator.gpu.requestAdapter({
            powerPreference: "high-performance",
        }))!;
        console.log(adapter);
        const device = await adapter.requestDevice({
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

    unmountTutorial() {
        this.setState({renderTutorial: false});
    }
  
    render() {
      return (
        <div>
            {this.state.renderTutorial ?  <Tutorial unmount={this.unmountTutorial}/> : null}
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