# GraphWaGu

This repo holds the source code to GraphWaGu, the project described in "GraphWaGu: GPU Powered Large Scale Graph Layout
Computation and Rendering for the Web." This project provides a tool for computing layout and rendering for graphs in the browser using the WebGPU API. It provides features for adjusting the cooling factor and ideal length to manipulate the graphs output by the Fruchterman-Reingold and Barnes-Hut algorithms defined in the paper above. As of now, support is only for undirected, 2-dimensional graphs via json files in the format (same as D3) of lists of nodes and edges.


## Compile and Run

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app). In order to run this project, you must run:
```
npm install
npm run start-local
```
The project will then be hosted on localhost:3000 and can be visited by a browser compatible with WebGPU.

## Contact
If you have questions or comments, feel free to contact me (Landon Dyken) at `ldyken53@uab.edu`.