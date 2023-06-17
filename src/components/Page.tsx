import React from 'react';
import Sidebar from './Sidebar';
import Tutorial from './Tutorial';
import { createRef, MutableRefObject } from 'react';
import Renderer from "../webgpu/render";
import { Form } from 'react-bootstrap';

type PageState = {
    canvasRef: MutableRefObject<HTMLCanvasElement | null>,
    iterRef: MutableRefObject<HTMLLabelElement | null>,
    renderer: Renderer | null,
    renderTutorial: boolean, renderAlert: boolean
}
class Page extends React.Component<{}, PageState> {
    constructor(props: {} | Readonly<{}>) {
        super(props);
        this.state = {
            canvasRef: createRef<HTMLCanvasElement | null>(), 
            iterRef: createRef<HTMLLabelElement | null>(),
            renderer: null, 
            renderTutorial: true, 
            renderAlert: false
        };
        this.unmountTutorial = this.unmountTutorial.bind(this);
    }

    async componentDidMount() {
        if (!navigator.gpu) {
            alert("GraphWaGu requires WebGPU, which is not currently enabled. You may be using an incompatible web browser or hardware, or have this feature disabled. If you are using Chrome, enable the setting at chrome://flags/#enable-unsafe-webgpu. If you are using Safari, first enable the Developer Menu (Preferences > Advanced), then check Develop > Experimental Features > WebGPU.");      
            this.setState({renderAlert: true});
            return;
        }
        const adapter = (await navigator.gpu.requestAdapter({
            powerPreference: "high-performance",
        }))!;
        if (!adapter) {
            alert("GraphWaGu requires WebGPU, which is not currently enabled. You may be using an incompatible web browser or hardware, or have this feature disabled. If you are using Chrome, enable the setting at chrome://flags/#enable-unsafe-webgpu. If you are using Safari, first enable the Developer Menu (Preferences > Advanced), then check Develop > Experimental Features > WebGPU.");      
            this.setState({renderAlert: true});
            return;
        }
        const device = await adapter.requestDevice({
            requiredLimits: {
                "maxStorageBufferBindingSize": adapter.limits.maxStorageBufferBindingSize,
                "maxComputeWorkgroupsPerDimension": adapter.limits.maxComputeWorkgroupsPerDimension
            }
        }); 
        this.setState({renderer: new Renderer(
            device, this.state.canvasRef, 
            this.state.iterRef)
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
            {this.state.renderAlert ?  
            <h1 className="header" color='white'>GraphWaGu requires WebGPU, which is not currently enabled. You may be using an incompatible web browser or hardware, or have this feature disabled. If you are using Chrome, enable the setting at chrome://flags/#enable-unsafe-webgpu. If you are using Safari, first enable the Developer Menu (Preferences - Advanced), then check Develop - Experimental Features - WebGPU.</h1> : 
            (
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
                </div> 
                </div>
            ) 
            }
        </div>
      );
    }
  }

export default Page;