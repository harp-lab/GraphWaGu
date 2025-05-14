# ForceDirected API Reference

A GPU-accelerated force-directed graph layout algorithm using WebGPU. Layouts are computed fully on GPU with Barnes-Hut Approximation.

## Installation

```bash
npm install graphwagu
```

## Usage

```javascript
import { ForceDirected } from 'graphwagu';

// Initialize with WebGPU device (with limits available to your hardware)
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice({
    requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
        maxBufferSize: adapter.limits.maxBufferSize,
        maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup,
        maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize
    }}
);
const forceDirected = new ForceDirected(device);

// Set node and edge data
const nodes = [
  /* value, x, y, size for each node */
  0, 0.2, 0.1, 0,
  0, 0.5, -0.1, 0,
  // ...
];
const edges = [
  /* source, target pairs */
  0, 1,  // Edge from node 0 to node 1
  1, 2,  // Edge from node 1 to node 2
  // ...
];

forceDirected.setNodeEdgeData(nodes, edges);

// Run the simulation
await forceDirected.runForces();

// Updated node positions are in forceDirected.nodeDataBuffer (GPUBuffer)
```

## Class: ForceDirected

### Constructor

#### `new ForceDirected(device: GPUDevice)`

Creates a new ForceDirected instance.

**Parameters:**
- `device` - A WebGPU device instance

**Example:**
```javascript
const forceDirected = new ForceDirected(device);
```

### Properties

#### `coolingFactor: number`
The cooling factor applied to the simulation (default: `0.985`). Controls how quickly the simulation stabilizes.

#### `theta: number`
The theta parameter for Barnes-Hut approximation (default: `0.8`). Lower values increase accuracy but decrease performance.

#### `l: number`
The ideal edge length parameter (default: `0.01`).

#### `iterationCount: number`
The number of iterations to run in one call to runForces() (default: `1`).

### Methods

#### `setNodeEdgeData(nodes: number[], edges: number[]): void`

Sets the node and edge data for the simulation.

**Parameters:**
- `nodes` - Array of node data in format `[value, x, y, size, value, x, y, size, ...]` where each group of 4 represents position (x, y) along with size and value (TODO: have size and value affect simulation) of a node
- `edges` - Array of edge data in format `[source, target, source, target, ...]` where each pair represents an edge between two nodes

**Example:**
```javascript
const nodes = [
  0, 0.2, 0.1, 0, // Node 0: position (0.2, 0.1)
  0, 0.5, -0.1, 0, // Node 1: position (0.5, -0.1)
];
const edges = [
  0, 1,  // Edge between node 0 and 1
];
forceDirected.setNodeEdgeData(nodes, edges);
```

#### `runForces(coolingFactor?: number, l?: number, theta?: number, iterationCount?: number): Promise<void>`

Runs the force-directed simulation.

**Parameters:**
- `coolingFactor` - Optional cooling factor (default: uses class property)
- `l` - Optional ideal edge length (default: uses class property)
- `theta` - Optional approximation parameter (default: uses class property)
- `iterationCount` - Optional number of iterations (default: uses class property)

**Returns:** Promise that resolves when simulation is complete

**Example:**
```javascript
// Run with default parameters
await forceDirected.runForces();

// Run with custom parameters
await forceDirected.runForces(0.99, 0.1, 1.5, 100);
```

## Requirements

- WebGPU-compatible browser
- Access to `navigator.gpu` API