import React from 'react';
import {Form, Button} from "react-bootstrap";
import ReactMarkdown from 'react-markdown';

type TutorialProps = {
    unmount: () => void,
}
class Tutorial extends React.Component<TutorialProps, {}> {
    constructor(props) {
      super(props);
      this.state = {
      };
  
      this.handleSubmit = this.handleSubmit.bind(this);
    }
  
    handleSubmit(event) {
      event.preventDefault();
      this.props.unmount();
    }
    
  
    render() {
        const markdown = `
# Welcome to GraphWaGu! 

**GraphWaGu** is a graph visualization system that supports force directed layout creation and rendering on the web. **GraphWaGu** was built using the **WebGPU** API to take advantage of GPU power for the web. 
## Usage

**GraphWaGU** supports using local JSON files for graph input, along with providing a small selection of test datasets. Upon clicking "Submit," the input graph will be rendered to the canvas, and then a force directed layout can be computed by clicking "Run Force Directed Layout."

### Using provided datasets

In the top left one can choose a dataset from the following list:
* Sf_ba6000 (6000 nodes, 5999 edges)
* Fe_4elt2.mtx (11143 nodes, 65636 edges)
* Pkustk02.mtx (10800 nodes, 399600 edges)
* Pkustk01.mtx (22044 nodes, 979380 edges)
* Finance256.mtx (37376 nodes, 298496 edges)

and then hit "Submit" to load the graph. Without a dedicated GPU, it's not recommended to try to use a dataset larger than the Fe_4elt2 example.

### Using local files

The file explorer is accessible using the button underneath the datasets selection. You can choose a local JSON file of nodes and edges (in D3 format) and then click "Submit" to render to the canvas before clicking "Run Force Directed Layout" to compute a layout. 

### Options
On the left sidebar, there are options for turning on/off rendering for "Nodes" and "Edges" under "Layers." There are also "Force Directed Options" which include two sliders to control "Ideal Length" and "Cooling Factor." Ideal length will control the spacing between nodes in the final layout created by the force directed algorithm, while the cooling factor determines how many iterations the algorithm will run. I wouldn't recommend changing ideal length, but raising the cooling factor can improve the quality of the output layout at the cost of taking longer to compute.         
        `;
      return (
        <div className="fill-window"> 
        <Form onSubmit={this.handleSubmit}>
            {/* <br/>
            <br/>
            <br/>
            <h1 style={{"fontSize": "5em"}} className="mt-10">
                Welcome to GraphWaGu!
            </h1> */}
            <ReactMarkdown className="markdown">{markdown}</ReactMarkdown>

            <Button style={{"width": "50%"}} type="submit" variant="secondary" value="Submit">Continue to GraphWaGu!</ Button>
        </Form>
        </ div>
      );
    }
  }

export default Tutorial;