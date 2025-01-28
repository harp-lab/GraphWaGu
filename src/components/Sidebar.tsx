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
  setNodeEdgeData: (nodeData: Array<number>, edgeData: Array<number>, sourceEdges: Array<number>, targetEdges: Array<number>, nodeColors: Array<number>) => void,
  setCoolingFactor: (value: number) => void,
  setIdealLength: (value: number) => void,
  setTheta: (value: number) => void,
  setEnergy: (value: number) => void,
  setIterationCount: (value: number) => void,
  toggleNodeLayer: () => void,
  toggleEdgeLayer: () => void,
  runForceDirected: () => void,
  stopForceDirected: () => void,
  takeScreenshot: () => void,
}
type SidebarState = {
  nodeData: Array<number>,
  edgeData: Array<number>,
  sourceEdges: Array<number>,
  targetEdges: Array<number>,
  nodeColors: Array<number>,
  adjacencyMatrix: Array<Array<number>>,
}
type edge = {
  source: number,
  target: number
}
type Graph = {
  nodes: Array<any>,
  edges: Array<edge>
}
class Sidebar extends React.Component<SidebarProps, SidebarState> {
  constructor(props: SidebarProps | Readonly<SidebarProps>) {
    super(props);
    this.state = {
      nodeData: [], edgeData: [], sourceEdges: [], targetEdges: [],
      nodeColors: [], adjacencyMatrix: []
    };

    this.handleSubmit = this.handleSubmit.bind(this);
    this.readJson = this.readJson.bind(this);
    this.chooseDataset = this.chooseDataset.bind(this);
  }

  handleSubmit(event: { preventDefault: () => void; }) {
    event.preventDefault();
    console.log(this.state.nodeColors);
    this.props.setNodeEdgeData(this.state.nodeData, this.state.edgeData, this.state.sourceEdges, this.state.targetEdges, this.state.nodeColors);
  }

  loadGraph(graph: Graph) {
    const nodeData: Array<number> = [];
    const edgeData: Array<number> = [];
    const sourceEdges: Array<number> = [];
    const targetEdges: Array<number> = [];
    const colors: Array<number> = [];
      
    for (let i = 0; i < graph.nodes.length; i++) {
      if (graph.nodes[i].x) {
        nodeData.push(0.0, graph.nodes[i].x, graph.nodes[i].y, 1.0);
      } else {
        nodeData.push(
          0.0, Math.random() 
          * Math.max(1, (graph.nodes.length / 100000))
          , Math.random() 
          * Math.max(1, (graph.nodes.length / 100000))
          , 1.0);
      }
      if (graph.nodes[i].color) {
        colors.push(...graph.nodes[i].color);
      }
    }
    console.log(nodeData);
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
    graph.edges.sort(function (a, b) { return (a.target > b.target) ? 1 : ((b.target > a.target) ? -1 : 0); });
    for (let i = 0; i < graph.edges.length; i++) {
      const source = graph.edges[i].source;
      const target = graph.edges[i].target;
      targetEdges.push(source, target);
    }
    console.log(graph.edges);
    this.setState({ nodeData: nodeData, edgeData: edgeData, sourceEdges: sourceEdges, targetEdges: targetEdges, nodeColors: colors });
  }

  async readJson(event: React.ChangeEvent<HTMLInputElement>) {
    const files: FileList = event.target.files!;
    const file = files[0];
    console.log(file);
    if (file.type == "application/xml") {
      const nodes: Array<any> = [];
      const edges: Array<any> = [];
      let partialLine = ''; // Store incomplete lines between chunks
      let headerProcessed = false;
      let i = 0;
  
      try {
        const stream = file.stream();
        const reader = stream.getReader();
        const decoder = new TextDecoder();
  
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
  
          // Decode this chunk and prepend any partial line from the previous chunk
          const text = partialLine + decoder.decode(value, { stream: true });
          const lines = text.split('\n');
          
          // Save the last partial line for the next chunk
          partialLine = lines.pop() || '';
  
          // Process the lines in this chunk
          for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (!headerProcessed) {
              // Skip comments and process header
              if (!trimmedLine.startsWith('%')) {
                const [rows, cols] = trimmedLine.split(/\s+/).map(Number);
                const numNodes = Math.max(rows, cols);
                const chunkSize = 100000;
                for (let j = 0; j < numNodes; j += chunkSize) {
                  const end = Math.min(j + chunkSize, numNodes);
                  nodes.push(...Array.from({ length: end - j }, (_, index) => ({
                    id: j + index,
                    label: (j + index).toString()
                  })));
                }
                
                headerProcessed = true;
                console.log(`Created ${nodes.length} nodes`);
              }
            } else if (trimmedLine) {
              // Process edge
              i++;
              const values = trimmedLine.split(/\s+/);
              const row = parseInt(values[0]) - 1;
              const col = parseInt(values[1]) - 1;
              
              edges.push({
                source: row,
                target: col
              });
  
              // Optional progress logging
              if (i % 1000000 === 0) {
                console.log(`Processed ${i} edges`);
              }
            }
          }
        }
  
        // Process the final partial line if it contains data
        if (partialLine.trim()) {
          const values = partialLine.trim().split(/\s+/);
          const row = parseInt(values[0]) - 1;
          const col = parseInt(values[1]) - 1;
          edges.push({
            source: row,
            target: col
          });
        }
  
        // Load the complete graph
        this.loadGraph({ nodes, edges } as Graph);
  
      } catch (error) {
        console.error('Error processing file:', error);
      }
    } else {
      const jsonReader = new FileReader();
      jsonReader.onload = () => {
        this.loadGraph(JSON.parse(jsonReader.result as string) as Graph);
      };
      jsonReader.readAsText(files[0]);
    }
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
            <Collapsible trigger="Layers" open={true}>
              <Form.Check defaultChecked={true} onClick={() => this.props.toggleNodeLayer()} type="checkbox" label="Node Layer" />
              <Form.Check defaultChecked={true} onClick={() => this.props.toggleEdgeLayer()} type="checkbox" label="Edge Layer" />
            </Collapsible>
            {/*@ts-ignore */}
            <Collapsible trigger="Force Directed Options" open={true}>
              <div className="d-flex align-items-center mb-2">
                <Form.Label className="mb-0 me-2" style={{ width: '120px' }}>Ideal Length:</Form.Label>
                <Form.Control
                  type="number"
                  defaultValue={0.001}
                  min={0.0001}
                  max={0.05}
                  step={0.0001}
                  onChange={(e) => this.props.setIdealLength(parseFloat(e.target.value))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <Form.Label className="mb-0 me-2" style={{ width: '120px' }}>Cooling Factor:</Form.Label>
                <Form.Control
                  type="number"
                  defaultValue={0.985}
                  min={0.85}
                  max={0.999}
                  step={0.001}
                  onChange={(e) => this.props.setCoolingFactor(parseFloat(e.target.value))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <Form.Label className="mb-0 me-2" style={{ width: '120px' }}>Theta:</Form.Label>
                <Form.Control
                  type="number"
                  defaultValue={8}
                  min={0.5}
                  max={32.0}
                  step={0.1}
                  onChange={(e) => this.props.setTheta(parseFloat(e.target.value))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <Form.Label className="mb-0 me-2" style={{ width: '120px' }}>Energy:</Form.Label>
                <Form.Control
                  type="number"
                  defaultValue={0.002}
                  min={0.001}
                  max={2.0}
                  step={0.001}
                  onChange={(e) => this.props.setEnergy(parseFloat(e.target.value))}
                />
              </div>

              <div className="d-flex align-items-center mb-2">
                <Form.Label className="mb-0 me-2" style={{ width: '120px' }}>Iteration Count:</Form.Label>
                <Form.Control
                  type="number"
                  defaultValue={40000}
                  min={100}
                  max={100000}
                  step={100}
                  onChange={(e) => this.props.setIterationCount(parseFloat(e.target.value))}
                />
              </div>
            </Collapsible>
            <br />
            <Button 
              className="me-2" 
              onClick={() => this.props.runForceDirected()}
            >
              Run Force Directed Layout
            </Button>
            <Button 
              variant="danger" 
              onClick={() => this.props.stopForceDirected()}
            >
              Stop
            </Button>
            <Button 
              onClick={() => this.props.takeScreenshot()}
            >
              Take Screenshot
            </Button>
          </Form>
        </Fragment>
      </ div>
    );
  }
}

export default Sidebar;