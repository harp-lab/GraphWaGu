# GraphWaGu

This repo holds the source code to GraphWaGu, the project described in "GraphWaGu: GPU Powered Large Scale Graph Layout
Computation and Rendering for the Web." This project provides a tool for computing layout and rendering for graphs in the browser using the WebGPU API. It provides features for adjusting the cooling factor and ideal length to manipulate the graphs output by the Fruchterman-Reingold and Barnes-Hut algorithms defined in the paper above. As of now, support is only for undirected, 2-dimensional graphs via json files in the format (same as D3) of lists of nodes and edges. [Paper PDF](https://drive.google.com/file/d/16PWup93vFLCWqQexop2IfRyMeQGniLqa/view)

## Demo
While this repo holds the source code and can be run locally, a fully functioning demo of this tool is available [here](https://harp-lab.github.io/GraphWaGu/). I recommend checking this out first, it doesn't require enabling any developer settings if you use Google Chrome and includes example datasets and the ability to choose your own local files.

## Compile and Run

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app). In order to run this project, you must run:
```
pnpm i
pnpm run dev
```
The project will then be hosted on localhost:3000 and can be visited by a browser compatible with WebGPU. If you are using Chrome, enable the setting at chrome://flags/#enable-unsafe-webgpu. If you are using Safari, first enable the Developer Menu (Preferences > Advanced), then check Develop > Experimental Features > WebGPU.

## Contact
If you have questions or comments, feel free to contact me (Landon Dyken) at `ldyken53@uab.edu`.