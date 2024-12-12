import React, { Fragment } from 'react';
import { Form, Button } from "react-bootstrap";
import Collapsible from 'react-collapsible';
import Select from 'react-select';

const basePath = location.hostname === 'localhost' ? '/public/' : '/GraphWaGu/';

async function getJson(fileName: string) {
  const url = new URL(basePath + fileName, location.href);
  const response = await fetch(url);
  return response.json();
}

const dataset_list = ['sf_ba6000', 'fe_4elt2.mtx', 'pkustk02.mtx', 'pkustk01.mtx', 'finance256.mtx'];

const datasets = {
  'sf_ba6000': getJson('sf_ba6000.json'),
  'fe_4elt2.mtx': getJson('fe_4elt2.mtx.json'),
  'pkustk02.mtx': getJson('pkustk02.mtx.json'),
  'pkustk01.mtx': getJson('pkustk01.mtx.json'),
  'finance256.mtx': getJson('finance256.mtx.json'),
}


type SidebarProps = {
  setNodeEdgeData: (nodeData: Array<number>, edgeData: Array<number>, sourceEdges: Array<number>, targetEdges: Array<number>) => void,
  setCoolingFactor: (value: number) => void,
  setIdealLength: (value: number) => void,
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
  constructor(props: SidebarProps | Readonly<SidebarProps>) {
    super(props);
    this.state = {
      nodeData: [], edgeData: [], sourceEdges: [], targetEdges: [],
      adjacencyMatrix: []
    };

    this.handleSubmit = this.handleSubmit.bind(this);
    this.readJson = this.readJson.bind(this);
    this.chooseDataset = this.chooseDataset.bind(this);
  }

  handleSubmit(event: { preventDefault: () => void; }) {
    event.preventDefault();
    this.props.setNodeEdgeData(this.state.nodeData, this.state.edgeData, this.state.sourceEdges, this.state.targetEdges);
  }

  loadGraph(graph: Graph) {
    const nodeData: Array<number> = [];
    const edgeData: Array<number> = [];
    const sourceEdges: Array<number> = [];
    const targetEdges: Array<number> = [];

    for (let i = 0; i < graph.nodes.length; i++) {
      if (graph.nodes[i].x) {
        nodeData.push(0.0, graph.nodes[i].x, graph.nodes[i].y, 1.0);
      } else {
        nodeData.push(0.0, Math.random(), Math.random(), 1.0);
      }
    }
    for (let i = 0; i < graph.edges.length; i++) {
      const source = graph.edges[i].source;
      const target = graph.edges[i].target;
      edgeData.push(source, target);
    }

    graph.edges.sort(function (a, b) { return (a.source > b.source) ? 1 : ((b.source > a.source) ? -1 : 0); });
    for (let i = 0; i < graph.edges.length; i++) {
      const source = graph.edges[i].source;
      const target = graph.edges[i].target;
      sourceEdges.push(source, target);
    }
    console.log(sourceEdges);
    graph.edges.sort(function (a, b) { return (a.target > b.target) ? 1 : ((b.target > a.target) ? -1 : 0); });
    for (let i = 0; i < graph.edges.length; i++) {
      const source = graph.edges[i].source;
      const target = graph.edges[i].target;
      targetEdges.push(source, target);
    }
    console.log(graph.edges);
    this.setState({ nodeData: nodeData, edgeData: edgeData, sourceEdges: sourceEdges, targetEdges: targetEdges });
  }

  readJson(event: React.ChangeEvent<HTMLInputElement>) {
    const files: FileList = event.target.files!;
    const jsonReader = new FileReader();
    jsonReader.onload = () => {
      this.loadGraph(JSON.parse(jsonReader.result as string) as Graph);
    };
    jsonReader.readAsText(files[0]);
  }

  async chooseDataset(dataset: keyof typeof datasets) {
    const graph = (await datasets[dataset]) as unknown as Graph;
    this.loadGraph(graph);
  }

  render() {
    return (
      <div className="sidebar">
        <Fragment>
          <Form style={{ color: 'white' }} onSubmit={this.handleSubmit}>
            <Form.Group controlId="formFile" className="mt-3 mb-3">
              <Form.Label>Choose from list of datasets...</Form.Label>
              {/*@ts-ignore */}
              <Select className='black' placeholder="Choose dataset..." onChange={(e) => this.chooseDataset(e!.value as any)} options={dataset_list.map((cm) => { return { "label": cm, "value": cm } })}></Select>
              <Form.Label>Choose your own JSON file...</Form.Label>
              <Form.Control className="form-control" type="file" multiple onChange={(e) => { this.readJson(e as React.ChangeEvent<HTMLInputElement>) }} />
              <Button className="mt-2" type="submit" variant="secondary" value="Submit">Submit</ Button>
            </Form.Group>
            {/*@ts-ignore */}
            <Collapsible trigger="Layers">
              <Form.Check defaultChecked={true} onClick={() => this.props.toggleNodeLayer()} type="checkbox" label="Node Layer" />
              <Form.Check defaultChecked={true} onClick={() => this.props.toggleEdgeLayer()} type="checkbox" label="Edge Layer" />
            </Collapsible>
            {/*@ts-ignore */}
            <Collapsible trigger="Force Directed Options">
              <Form.Label> Ideal Length and Cooling Factor </Form.Label>
              <br />
              <input type="range" defaultValue={0.01} min={0.001} max={0.05} step={0.001} onChange={(e) => this.props.setIdealLength(parseFloat(e.target.value))} />
              <input type="range" defaultValue={0.985} min={0.85} max={0.999} step={0.001} onChange={(e) => this.props.setCoolingFactor(parseFloat(e.target.value))} />
            </Collapsible>
            <br />
            <Button onClick={() => this.props.runForceDirected()}>
              Run Force Directed Layout
            </Button>
          </Form>
        </Fragment>
      </ div>
    );
  }
}

export default Sidebar;