import random
import json, time
import numpy as np
from scipy.sparse.linalg import eigs

nodes = []
N = 5
clusters = 2
edges = []
nodes = {}
for i in range(clusters):
    print(i)
    print((i + 1) / (clusters + 2))
    for j in range(N * 2):
        source = random.randint(i * (N // clusters), i * (N // clusters) + (N // clusters - 1))
        target = random.randint(i * (N // clusters), i * (N // clusters) + (N // clusters - 1))
        # if laplacian_matrix[source, target] == 0 and source != target:
        #     laplacian_matrix[source, target] = -1
        #     laplacian_matrix[target, source] = -1
        #     laplacian_matrix[source, source] += 1
        #     laplacian_matrix[target, target] += 1
        if not nodes.get(source):
            nodes[source] = {
                "name": str(source), 
                "x": random.gauss((i + 1) / (clusters + 1), 0.025), 
                "y": random.gauss((i % 2 + 0.6) / 2, 0.025)
            }
        if not nodes.get(target):
            nodes[target] = {
                "name": str(target), 
                "x": random.gauss((i + 1) / (clusters + 1), 0.025), 
                "y": random.gauss((i % 2 + 0.6) / 2, 0.025)
            }
        edges.append({"source": source, "target": target})
nodes = [node for node in nodes.values()]
# for i in range(N):
#     nodes.append({"name": str(i), "x": random.random() * (i / N), "y": random.random() * (i / N)})
# clusters2 = 0
# for i in range(clusters2):
#     for j in range(N):
#         source = random.randint(i * (N // clusters2), i * (N // clusters2) + (N // clusters2 - 1))
#         target = random.randint(i * (N // clusters2), i * (N // clusters2) + (N // clusters2 - 1))
#         # if laplacian_matrix[source, target] == 0 and source != target:
#         #     laplacian_matrix[source, target] = -1
#         #     laplacian_matrix[target, source] = -1
#         #     laplacian_matrix[source, source] += 1
#         #     laplacian_matrix[target, target] += 1
#         edges.append({"source": source, "target": target})      
# for j in range(N // 100):
#     source = random.randint(0, N - 1)
#     target = random.randint(0, N - 1)
#     # if laplacian_matrix[source, target] == 0 and source != target:
#     #     laplacian_matrix[source, target] = -1
#     #     laplacian_matrix[target, source] = -1
#     #     laplacian_matrix[source, source] += 1
#     #     laplacian_matrix[target, target] += 1
#     edges.append({"source": source, "target": target})
# print(np.sum(laplacian_matrix))
# start = time.time()
# vals, vecs = eigs(laplacian_matrix, k=3, which="SM")
# end = time.time()
# print(end - start)
# start = time.time()
# np.linalg.eigh(laplacian_matrix)
# end = time.time()
# print(end - start)
# print(vals)
# x = np.real((vecs[:,1] - np.min(vecs[:,1])) / (np.max(vecs[:,1]) - np.min(vecs[:,1])))
# y = np.real((vecs[:,2] - np.min(vecs[:,2])) / (np.max(vecs[:,2]) - np.min(vecs[:,2])))
# for i in range(N):
#     nodes.append({"name": str(i), "x": x[i], "y": y[i]})
# for i in range(N):
#     nodes.append({"name": str(i), "x": random.random(), "y": random.random()})
# for j in range(4):
#     for i in range(100000):
#         source = random.randint(0, j * 2000)
#         target = random.randint(j * 2000, 19999)
#         edges.append({"source": source, "target": target})
# nodes = []
# edges = []
# for i in range(10):
#     nodes.append({"name": str(i)})
#     if i == 9:
#         edges.append({"source": i, "target": 0})
#     else:
#         edges.append({"source": i, "target": i+1})
graph = {
    "nodes": nodes,
    "edges": edges
}
f = open("test_tiny2.json", "w")
f.write(json.dumps(graph))



