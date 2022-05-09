import React from 'react';
import {Form, Button} from "react-bootstrap";
import Collapsible from 'react-collapsible';
import Select from 'react-select';
function importAll(r) {
    let datasets = {};
    r.keys().map((item, index) => { datasets[item.replace('./', '').replace('.png', '')] = r(item); });
    return datasets;
}
  
const datasets = importAll(require.context('../../datasets', false, /\.(json)$/));
const dataset_list = ['bodyy6.mtx', 'fe_4elt2.mtx', 'finance256.mtx', 'pkustk01.mtx', 'pkustk02.mtx', 'sf_ba6000'];
console.log(datasets);

type SidebarProps = {
  setNodeEdgeData: (nodeData : Array<number>, edgeData : Array<number>, sourceEdges : Array<number>, targetEdges : Array<number>) => void,
  setCoolingFactor: (value : number) => void,
  setIdealLength: (value : number) => void,
  toggleNodeLayer: () => void,
  toggleEdgeLayer: () => void,
  runForceDirected: () => void,
}
type SidebarState = {
  nodeData: Array<number>,
  edgeData: Array<number>,
  sourceEdges: Array<number>,
  targetEdges: Array<number>,
  adjacencyMatrix: Array<Array<number>>,
}
type edge = {
  source: number,
  target: number
}
type node = {
  name: string,
  x: number,
  y: number
}
type Graph = {
  nodes: Array<node>,
  edges: Array<edge>
}
class Sidebar extends React.Component<SidebarProps, SidebarState> {
    constructor(props) {
      super(props);
      this.state = {
        nodeData: [], edgeData: [], sourceEdges: [], targetEdges: [],
        adjacencyMatrix: []
      };
  
      this.handleSubmit = this.handleSubmit.bind(this);
      this.readJson = this.readJson.bind(this);
      this.chooseDataset = this.chooseDataset.bind(this);
    }
  
    handleSubmit(event) {
      event.preventDefault();
      this.props.setNodeEdgeData(this.state.nodeData, this.state.edgeData, this.state.sourceEdges, this.state.targetEdges);
    }

    loadGraph(graph : Graph) {
      var nodeData : Array<number> = [];
      var edgeData : Array<number> = [];
      var sourceEdges : Array<number> = [];
      var targetEdges : Array<number> = [];
      console.log(graph);
      for (var i = 0; i < graph.nodes.length; i++) {
        if (graph.nodes[i].x) {
          nodeData.push(0.0, graph.nodes[i].x, graph.nodes[i].y, 1.0);
        } else {
          nodeData.push(0.0, Math.random(), Math.random(), 1.0);
        }
      }
      for (var i = 0; i < graph.edges.length; i++) {
        var source = graph.edges[i].source;
        var target = graph.edges[i].target;
        edgeData.push(source, target);
      }
      graph.edges.sort(function(a,b) {return (a.source > b.source) ? 1 : ((b.source > a.source) ? -1 : 0);} );
      for (var i = 0; i < graph.edges.length; i++) {
        var source = graph.edges[i].source;
        var target = graph.edges[i].target;
        sourceEdges.push(source, target);
      }
      console.log(sourceEdges);
      graph.edges.sort(function(a,b) {return (a.target > b.target) ? 1 : ((b.target > a.target) ? -1 : 0);} );
      for (var i = 0; i < graph.edges.length; i++) {
        var source = graph.edges[i].source;
        var target = graph.edges[i].target;
        targetEdges.push(source, target);
      }
      console.log(graph.edges);
      this.setState({nodeData: nodeData, edgeData: edgeData, sourceEdges: sourceEdges, targetEdges: targetEdges});
    }

    readJson(event : React.ChangeEvent<HTMLInputElement>) {
      const files : FileList = event.target.files!;
      const jsonReader = new FileReader();
      jsonReader.onload = (event) => {
        this.loadGraph(JSON.parse(jsonReader.result as string) as Graph);
      };
      jsonReader.readAsText(files[0]);
    }

    chooseDataset(dataset) {
      this.loadGraph(datasets[`${dataset}.json`] as Graph);
    }
  
    render() {
      return (
        <div className="sidebar"> 
        <Form style={{color: 'white'}} onSubmit={this.handleSubmit}>
          <Form.Group controlId="formFile" className="mt-3 mb-3">
            <Form.Label>Choose from list of datasets...</Form.Label>
            <Select className='black' placeholder="Choose dataset..." onChange={(e) => this.chooseDataset(e!.value)} options={ dataset_list.map((cm) => {return {"label": cm, "value": cm}})}></Select>
            <Form.Label>Choose your own JSON file...</Form.Label>
            <Form.Control className="form-control" type="file" multiple onChange={(e) => {this.readJson(e as React.ChangeEvent<HTMLInputElement>)}}/>
            <Button className="mt-2" type="submit" variant="secondary" value="Submit">Submit</ Button>
          </Form.Group>
          <Collapsible trigger="Layers"> 
            <Form.Check defaultChecked={true} onClick={(e) => this.props.toggleNodeLayer()} type="checkbox" label="Node Layer"/>
            <Form.Check defaultChecked={true} onClick={(e) => this.props.toggleEdgeLayer()} type="checkbox" label="Edge Layer"/>
          </Collapsible>
          <Collapsible trigger="Force Directed Options">
            <Form.Label> Ideal Length and Cooling Factor </Form.Label>
            <br/>
            <input type="range" defaultValue={0.01} min={0.001} max={0.05} step={0.001} onChange={(e) => this.props.setIdealLength(parseFloat(e.target.value))} />
            <input type="range" defaultValue={0.975} min={0.85} max={0.999} step={0.001} onChange={(e) => this.props.setCoolingFactor(parseFloat(e.target.value))} />
          </Collapsible>
          <br/>
          <Button onClick={(e) => this.props.runForceDirected()}>
            Run Force Directed Layout
          </Button>
        </Form>
        </ div>
      );
    }
  }

export default Sidebar;