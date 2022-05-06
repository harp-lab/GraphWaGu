import random
import json, time
import numpy as np
from scipy.sparse.linalg import eigs

f = open("HAPPI_Table.txt")
lines = f.read().split("\n")
nodeIDToIndex = {}
i = 0
nodes = []
edges = []
for line in lines[1:]:
    node1, node2, weight = line.split()
    if not nodeIDToIndex.get(node1):
        nodeIDToIndex[node1] = i
        nodes.append({"name": str(i), "x": random.random(), "y": random.random()})
        i += 1
    if not nodeIDToIndex.get(node2):
        nodeIDToIndex[node2] = i
        nodes.append({"name": str(i), "x": random.random(), "y": random.random()})
        i += 1   
    if float(weight) > 0.75:
        edges.append({"source": nodeIDToIndex[node1], "target": nodeIDToIndex[node2]})
    if len(nodes) > 15000:
        break
graph = {
    "nodes": nodes,
    "edges": edges
}
f = open("test_HAPPI.json", "w")
f.write(json.dumps(graph))



